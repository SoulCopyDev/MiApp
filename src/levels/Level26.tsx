import { exitLevel } from '../utils/exitLevel';
import { router } from 'expo-router';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { useReportProgress } from '../components/LevelProgress';
import { typography } from '../theme';
import XPToast from '../components/XPToast';
import { pickN, shuffle, shuffleDistinct } from '../utils/shuffle';

// ═══════════════════════════════════════════════════════════
// Nivel 26 · Haz que la IA Trabaje Sola
// Mundo 5 · TEMA CLARO (cyan/sky: #0891b2 → #0ea5e9).
// Reconstruido vs nivel-26.html (estándar v2.2). 19 módulos.
// ═══════════════════════════════════════════════════════════

// ── Paleta (light, extraída del CSS del HTML) ──
const P = {
  screen: '#ffffff',
  ink: '#111827', body: '#374151', muted: '#6b7280', faint: '#9ca3af',
  cyan: '#0891b2', cyanText: '#155e75', cyanBg: '#ecfeff', cyanBorder: '#a5f3fc',
  sky: '#0ea5e9',
  border: '#e5e7eb', cardBg: '#f9fafb',
  green: '#16a34a', greenBg: '#dcfce7', greenText: '#166534', greenSoft: '#f0fdf4', greenBorder: '#bbf7d0',
  red: '#dc2626', redBg: '#fef2f2', redText: '#991b1b',
  blueBg: '#eff6ff', blueText: '#1e40af',
  purpleBg: '#fdf4ff', purpleBorder: '#e9d5ff', purpleText: '#7e22ce',
  pinkBg: '#fce7f3', pinkText: '#9d174d', botChip: '#cffafe',
  amberBg: '#fef3c7', amberText: '#92400e', yellowBg: '#fefce8', yellowBorder: '#fde68a',
  sprintBg: '#fff7ed', sprintBorder: '#fed7aa', sprintTime: '#c2410c', sprintMark: '#9a3412',
  flowBg: '#f0f9ff', flowBorder: '#bae6fd',
  codeBg: '#0f172a', codeText: '#e2e8f0', codeKey: '#67e8f9', codeEmpty: '#64748b',
};

const TOTAL_STEPS = 21;   // 0 intro · 1-19 módulos · 20 completado
const CONTENT_STEPS = 19;
const THEORY_STEPS = new Set([0, 1, 4, 5, 13]); // solo lectura → botón "Volver"

// ── Tipos ──
type DragItem = { text: string; correct: 'bot' | 'pers' };
type QuizQ = { q: string; opts: string[]; correct: number; explain: string };
type TFItem = { stmt: string; correct: boolean; explain: string };
type ScenarioChoice = { title: string; text: string; correct: boolean; explain: string };
type EthicsItem = { text: string; correct: 'ok' | 'cuest' | 'no'; explain: string };
type SprintItem = { text: string; good: boolean };
type ConnectQ = { label: string; opts: { t: string; ok: boolean }[] };
type BuilderConfig = { xp: number; rows: { key: string; label: string; opts: string[] }[] };

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
  if (unique.size / words.length < 0.5) return true;
  const noVowel = words.filter((w) => w.length >= 3 && !/[aeiou]/.test(w)).length;
  return noVowel / words.length > 0.3;
};
const REFLECT_TERMS = ['automat', 'tarea', 'flujo', 'ia', 'trigger', 'disparador', 'zapier', 'make', 'n8n', 'email', 'correo', 'whatsapp', 'regla', 'delegar', 'tiempo', 'repetit', 'humano', 'decision', 'notion', 'resum', 'recordar', 'enviar', 'crear', 'creativ', 'proceso', 'maquina', 'app', 'jamas', 'nunca', 'bot'];
const containsTopic = (text: string): boolean => {
  const n = normalizeText(text);
  const words = n.split(/[^a-z0-9]+/).filter(Boolean);
  return REFLECT_TERMS.some((t) => (t.length <= 3 ? words.includes(t) : n.includes(t)));
};

// ── Pools de datos (fuente: nivel-26.html) ──
const DOER_POOL: DragItem[] = [
  { text: 'Enviar 50 emails idénticos de bienvenida a nuevos usuarios', correct: 'bot' },
  { text: 'Publicar un tweet cuando sale un video nuevo en YouTube', correct: 'bot' },
  { text: 'Guardar en Drive los archivos que llegan por WhatsApp del trabajo', correct: 'bot' },
  { text: 'Mandar recordatorio cada lunes a las 9am al grupo del colegio', correct: 'bot' },
  { text: "Crear evento en Google Calendar cuando llega email con 'reunión'", correct: 'bot' },
  { text: 'Descargar cada viernes la lista de ventas del Excel corporativo', correct: 'bot' },
  { text: 'Transcribir reuniones grabadas de Zoom a texto', correct: 'bot' },
  { text: 'Decidir si contratar o despedir a un empleado', correct: 'pers' },
  { text: 'Consolar a un amigo que acaba de perder a un familiar', correct: 'pers' },
  { text: 'Dictar la sentencia final en un juicio penal', correct: 'pers' },
  { text: 'Negociar una alianza diplomática entre dos países', correct: 'pers' },
  { text: 'Elegir con quién vas a casarte', correct: 'pers' },
];

// Distractores alargados para que la correcta no sea la más larga (§15/27).
const QUIZ_POOL: QuizQ[] = [
  { q: "¿Qué significa 'disparador' (trigger) en una automatización?", opts: ['El evento que inicia la automatización', 'El error interno que detiene todo el flujo', 'Un botón rojo que sirve para borrar todo', 'La acción que ocurre al final del flujo'], correct: 0, explain: "Trigger = 'cuando X sucede...'. Ej: llega email, formulario completado, son las 9am." },
  { q: "Flujo: 'email con factura → guarda en Drive → agrega fila a Sheets'. ¿Cuál es la ACCIÓN final?", opts: ['Que llegue el email a la bandeja', "Que tenga 'factura' en el asunto", 'Agregar la fila a Google Sheets', 'El PDF que viene adjunto al email'], correct: 2, explain: 'Última acción = resultado con valor. Email = trigger; Drive = intermedio; Sheets = cierre.' },
  { q: 'Diferencia clave entre Zapier y Make:', opts: ['Zapier es gratis y Make siempre se paga', 'Make es visual con diagramas; Zapier es lineal paso a paso', 'Zapier solo funciona en inglés y Make en español', 'Make no puede conectarse con Gmail de ninguna forma'], correct: 1, explain: 'Make = diagrama visual. Zapier = lineal. Ambos miles de apps.' },
  { q: '¿Qué NO deberías automatizar — nunca?', opts: ['Publicar un post cuando subes un video nuevo', 'Responder emocionalmente a un amigo en crisis', 'Generar los reportes de ventas de fin de mes', 'Agendar reuniones de trabajo en tu calendario'], correct: 1, explain: 'Decisiones con carga emocional o moral requieren presencia humana real.' },
  { q: 'Usas IA para responder emails de clientes cuando no estás. ¿Riesgo ético?', opts: ['Que la IA responde mucho más rápido que tú', 'Que los clientes creen que hablan contigo (engaño)', 'Que la IA escribe siempre sin ninguna falta', 'Que la IA usa demasiados emojis en los mensajes'], correct: 1, explain: "Engaño. Solución: transparencia ('respuesta asistida por IA') o IA solo como borrador." },
  { q: "'Cuando llegue PDF → resumir con IA → guardar en Notion'. ¿Qué orquesta esto?", opts: ['Photoshop', 'Microsoft Word', 'Zapier, Make o n8n', 'Solo Gmail'], correct: 2, explain: 'Zapier/Make/n8n = orquestadores. Gmail es solo el trigger.' },
  { q: 'Automatizas TikTok → Instagram, pero copia hashtags de TikTok. ¿Qué pasó?', opts: ['Es totalmente imposible automatizar ese tipo de cosa', 'No se adaptó al contexto — faltó una capa inteligente', 'Instagram te baneó la cuenta por copiar contenido', 'Los hashtags eran exactamente iguales en las dos apps'], correct: 1, explain: 'Cada plataforma tiene su lenguaje. Buena automatización ADAPTA con IA, no solo copia.' },
  { q: "¿Qué es un 'webhook'?", opts: ['Un error interno que ocurre en el servidor', 'Una señal que una app envía cuando pasa algo y dispara flujos', 'Un antivirus que protege tus automatizaciones', 'Una base de datos donde se guardan los flujos'], correct: 1, explain: "Webhook = app A avisa 'pasó X', lanza flujo en otra herramienta. Espina dorsal." },
];

const TF_POOL: TFItem[] = [
  { stmt: 'Automatizar responder a clientes sin revisar puede dañar tu reputación si la IA se equivoca', correct: true, explain: 'Una respuesta automática en mal momento (cliente enojado) escala todo.' },
  { stmt: 'Si una automatización funciona hoy, NUNCA fallará', correct: false, explain: 'Una API cambia, un email se pierde, un límite se alcanza. Monitorear siempre.' },
  { stmt: 'Automatizar demasiado puede hacerte perder el pulso de tu propio proyecto', correct: true, explain: 'Si nunca ves los datos en vivo, no notas tendencias. Automatiza rutina, mantente presente en lo estratégico.' },
  { stmt: 'Las automatizaciones con IA son siempre gratis', correct: false, explain: 'Zapier, Make y OpenAI tienen límites gratuitos. A escala, cuesta.' },
  { stmt: 'Publicar lo mismo en Twitter, LinkedIn e Instagram sin adaptar es mala práctica', correct: true, explain: 'Cada plataforma tiene su lenguaje. Adapta con IA; no solo copies.' },
  { stmt: 'Los webhooks son señales que una app envía cuando pasa algo — y son clave para automatizar', correct: true, explain: 'El disparador técnico detrás de muchos flujos modernos.' },
  { stmt: 'Automatizar contratación con IA está libre de riesgos éticos', correct: false, explain: 'Ha causado sesgos raciales y de género documentados. Requiere supervisión.' },
  { stmt: "'n8n' puede correr en tu propio servidor, dando más control sobre tus datos", correct: true, explain: 'Autohosting: tus datos no pasan por terceros. Ideal para privacidad estricta.' },
];

const ETHICS_POOL: EthicsItem[] = [
  { text: 'Automatizar enviar WhatsApp a familiares cuando llegas a casa', correct: 'ok', explain: 'ACEPTABLE. Útil, sin engaño, con consentimiento implícito.' },
  { text: "Automatizar respuestas 'como si fueras tú' a mensajes románticos de tu pareja", correct: 'no', explain: 'INACEPTABLE. Engaño directo en relación íntima. Destruye confianza.' },
  { text: 'Automatizar selección de CVs descartando candidatos sin revisar', correct: 'cuest', explain: 'CUESTIONABLE. Sesgos documentados. Requiere auditoría y supervisión humana.' },
  { text: 'Automatizar publicar nuevos videos de YouTube en Twitter', correct: 'ok', explain: 'ACEPTABLE. Contenido propio, sin engaño, ahorra tiempo.' },
  { text: "Automatizar 'felicidades cumpleaños' a todos tus contactos sin editar", correct: 'cuest', explain: 'CUESTIONABLE. Frío. Mejor: IA que personaliza cada mensaje.' },
  { text: 'Automatizar decisiones judiciales con IA sin juez humano', correct: 'no', explain: 'INACEPTABLE. Justicia requiere contexto, juicio moral, responsabilidad humana.' },
  { text: 'Automatizar envío de tarea escolar cuando se vence la fecha', correct: 'ok', explain: 'ACEPTABLE. Te protege del olvido. Decisión tuya, ejecución del sistema.' },
  { text: 'Automatizar calificar exámenes complejos de literatura sin revisión', correct: 'no', explain: 'INACEPTABLE para evaluación humana compleja. IA como asistente, no juez.' },
];

const SPRINT_POOL: SprintItem[] = [
  { text: "Cuando llega email con 'factura' → guardar PDF en Drive", good: true },
  { text: 'Cuando publico video en TikTok → subir automáticamente a YouTube', good: true },
  { text: "Automatizar decir 'te amo' a tu pareja cada noche sin escribirlo", good: false },
  { text: 'Cuando son las 9am lunes → IA envía resumen de agenda por WhatsApp', good: true },
  { text: "Automatizar responder 'como si fueras tú' a mensajes importantes sin leer", good: false },
  { text: 'Cuando se agrega producto a Shopify → IA genera descripción y postea en IG', good: true },
  { text: 'Automatizar calificar exámenes de literatura con IA sin revisión', good: false },
  { text: 'Cuando me mencionan en Twitter → notificación prioritaria en Slack', good: true },
  { text: 'Automatizar contratar personal solo con filtro de IA sin entrevistas', good: false },
  { text: 'Cuando recibo mensaje de mi jefe → enviar plantilla genérica sin leer', good: false },
];
const SPRINT_META = 5;

const REPLACED_POOL: QuizQ[] = [
  { q: '¿Qué área de atención al cliente automatiza IA hoy casi por completo?', opts: ['Redactar contratos legales largos y complejos', 'Responder las preguntas frecuentes y el soporte de nivel 1', 'Negociar los precios finales con cada cliente', 'Resolver disputas complicadas entre dos clientes'], correct: 1, explain: 'FAQ y soporte nivel 1 ya es 70%+ IA. Nivel 2-3 sigue humano.' },
  { q: 'En comercio electrónico, ¿qué tarea ya se automatiza por defecto?', opts: ['Decidir qué productos nuevos va a lanzar la tienda', 'Actualizar el inventario y avisar a los clientes', 'Negociar los contratos con todos los proveedores', 'Diseñar las campañas creativas de publicidad'], correct: 1, explain: 'Inventario + notificaciones: 100% automatización estándar hoy.' },
  { q: 'En marketing digital, ¿qué tarea repetitiva ya se automatiza con IA?', opts: ['Definir la estrategia de marketing de todo el año', 'Generar variaciones de anuncios y hacer A/B testing', 'Elegir el tono y la personalidad de la marca', 'Decidir qué otras empresas comprar o fusionar'], correct: 1, explain: 'Google Ads y Meta Ads automatizan generación de variantes + optimización.' },
  { q: 'En gestión de contenido, ¿qué tarea ya se automatiza?', opts: ['Elegir el tema exacto sobre el que se va a escribir', 'Programar la publicación en varios canales a la vez', 'Definir la identidad visual y la voz de la marca', 'Crear desde cero todo el contenido original nuevo'], correct: 1, explain: 'Programación multiplataforma = automatización estándar.' },
  { q: 'En finanzas personales, ¿qué área automatizan apps como Nequi o Daviplata?', opts: ['Decidir cómo y en qué invertir tus ahorros', 'Categorizar los gastos y alertar de patrones raros', 'Elegir con qué persona formar una pareja', 'Negociar tu próximo ascenso con el jefe'], correct: 1, explain: 'Categorización + alertas: 100% IA. Las decisiones siguen siendo tuyas.' },
];

const FINAL_POOL: QuizQ[] = [
  { q: 'Tu empresa exige que los datos NO salgan del servidor corporativo. ¿Qué orquestador usas?', opts: ['Zapier (en la nube)', 'Make (en la nube)', 'n8n autohosteado', 'IFTTT'], correct: 2, explain: 'n8n autohosteado = datos en tu servidor. Única opción compatible.' },
  { q: "¿Qué es un 'multi-step zap' en Zapier?", opts: ['Un flujo con 2 o más acciones después del disparador', 'Un error de autenticación al conectar dos apps', 'Una función exclusiva del plan premium más caro', 'Un bot de Telegram que ejecuta los flujos'], correct: 0, explain: 'Multi-step = más allá de trigger + 1 acción. Requiere plan pago.' },
  { q: 'Al diseñar un flujo, ¿por qué empiezas por el TRIGGER y no por la acción final?', opts: ['Porque diseñarlo en ese orden es simplemente más fácil', 'Porque el trigger define qué datos habrá disponibles después', 'Porque empezar por el trigger resulta más barato', 'Por ninguna razón concreta, es un orden aleatorio'], correct: 1, explain: 'El trigger determina qué información fluye hacia las acciones.' },
  { q: "¿Qué hace un 'filter' en un flujo de Zapier?", opts: ['Borra los datos que pasan por el flujo', 'Detiene el flujo si no se cumple una condición', 'Añade ruido aleatorio a la información', 'Hace una copia de seguridad del flujo'], correct: 1, explain: 'Filter = compuerta. Ahorra acciones innecesarias.' },
  { q: "Diseñas: 'email → IA resume → WhatsApp'. ¿Qué API paga estás usando?", opts: ['Solamente Zapier, sin nada más', 'OpenAI o Claude para hacer el resumen', 'Ninguna, todo el proceso es gratis', 'Windows, el sistema de tu computadora'], correct: 1, explain: "El paso 'resumir con IA' llama a OpenAI/Claude/Gemini." },
  { q: "'Si cliente_VIP, notifica por SMS; si no, archiva'. ¿Qué herramienta es ideal?", opts: ['Zapier, porque es lineal y va paso a paso', 'Make, porque tiene un router visual para bifurcar', 'WhatsApp, porque envía mensajes automáticos', 'Excel, porque organiza los datos en tablas'], correct: 1, explain: 'Make tiene routers visuales para bifurcaciones.' },
];

const RESP_SCN: ScenarioChoice[] = [
  { title: "Mi pareja me escribe 'te extraño' y la IA responde por mí", text: "Un bot lee el mensaje, detecta emoción y responde 'yo también' sin que yo lo sepa.", correct: false, explain: 'Inaceptable. Las relaciones íntimas exigen respuesta humana real, no simulada.' },
  { title: "Un cliente envía 'cuál es el precio' y la IA responde con tabla oficial", text: 'La IA responde datos transaccionales objetivos mientras estoy en reunión.', correct: true, explain: 'Aceptable. Información factual repetitiva se delega sin conflicto ético.' },
  { title: "Un amigo me escribe 'mi papá acaba de morir' y la IA responde con pésame automático", text: 'Respuesta de condolencia genérica enviada sin que yo lo lea.', correct: false, explain: 'Crueldad involuntaria. Momentos así exigen presencia humana real.' },
  { title: "Un vendedor pregunta 'horario de atención' y la IA responde con info del sitio", text: 'Consulta impersonal, respuesta factual disponible públicamente.', correct: true, explain: 'Aceptable. Sin carga emocional, info pública — ideal para automatizar.' },
];

const SORT_FLOW = [
  'Identifica el problema: ¿qué tarea repetitiva te quita tiempo?',
  'Define el disparador: ¿qué evento debería iniciar el flujo?',
  'Diseña pasos intermedios: ¿qué hace el sistema entre trigger y resultado?',
  'Conecta las apps: en Zapier/Make/n8n, une los nodos',
  'Prueba con datos reales: ejecuta y verifica el output',
  'Monitorea en producción: revisa que siga funcionando y ajusta',
];

const CONNECT: { scenario: string; questions: ConnectQ[] } = {
  scenario: "Quieres que cuando llegue un email con 'informe', una IA lo resuma y guarde el resumen en Notion etiquetado con la fecha.",
  questions: [
    { label: '1. ¿Cuál es el DISPARADOR correcto?', opts: [{ t: 'Cada vez que envío un email', ok: false }, { t: "Cuando llega email a Gmail con 'informe' en el asunto", ok: true }, { t: 'Cuando creo una página en Notion', ok: false }] },
    { label: '2. ¿Cuál es el PASO INTERMEDIO correcto?', opts: [{ t: 'La IA traduce el email al francés', ok: false }, { t: 'Se envía un emoji al remitente', ok: false }, { t: 'La IA (OpenAI/Claude) resume el email en 5 puntos', ok: true }] },
    { label: '3. ¿Cuál es la ACCIÓN FINAL correcta?', opts: [{ t: 'Imprimir el resumen en papel', ok: false }, { t: 'Crear página en Notion con resumen y fecha', ok: true }, { t: 'Borrar el email original', ok: false }] },
  ],
};

const FLOW_CFG = {
  trigger: ["Llega email con 'tarea' en el asunto", 'Se graba una reunión en Zoom', 'Recibo una factura PDF por WhatsApp', 'Son las 7am de un lunes'],
  middle: ['La IA resume el contenido en 5 puntos clave', 'La IA lo traduce al inglés', 'La IA clasifica por prioridad (alta/media/baja)', 'La IA extrae nombres y fechas mencionadas'],
  final: ['Guarda el resultado en Notion', 'Envía el resultado por WhatsApp', 'Crea una fila en Google Sheets', 'Agenda un evento en Google Calendar'],
};

const BUILDER_DAY: BuilderConfig = { xp: 20, rows: [
  { key: 'manana', label: '☀️ Mañana (despertar → estudiar)', opts: ['IA envía resumen de noticias + tu agenda por WhatsApp a las 7am', 'IA traduce tus tareas del día a un checklist priorizado', 'Bot de calendario reagenda reuniones bajas si estás cansado'] },
  { key: 'tarde', label: '🌤️ Tarde (estudio/trabajo)', opts: ['IA convierte los PDFs de clase en resúmenes automáticos', 'Flujo: Gmail → Notion con archivos clasificados por tema', 'IA clasifica tus emails entrantes por urgencia'] },
  { key: 'noche', label: '🌙 Noche (cierre del día)', opts: ['IA genera un resumen de lo logrado + plan de mañana', 'Bot revisa pendientes y envía recordatorios', 'Backup automático de tus creaciones a Drive'] },
] };

// ── Tags ──
const tagVariants = {
  intro: { box: { backgroundColor: P.cyanBg }, text: { color: P.cyanText } },
  theory: { box: { backgroundColor: P.greenSoft }, text: { color: P.greenText } },
  activity: { box: { backgroundColor: P.blueBg }, text: { color: P.blueText } },
  build: { box: { backgroundColor: P.cyanBg }, text: { color: P.cyanText } },
  case: { box: { backgroundColor: P.purpleBg }, text: { color: P.purpleText } },
  example: { box: { backgroundColor: '#fff7ed' }, text: { color: '#9a3412' } },
  quiz: { box: { backgroundColor: P.amberBg }, text: { color: P.amberText } },
  sprint: { box: { backgroundColor: '#fee2e2' }, text: { color: P.redText } },
  reflect: { box: { backgroundColor: '#f3f4f6' }, text: { color: '#374151' } },
} as const;
const Tag = ({ icon, label, variant }: { icon: string; label: string; variant: keyof typeof tagVariants }) => (
  <View style={[styles.tag, tagVariants[variant].box]}><Text style={[styles.tagText, tagVariants[variant].text]}>{icon}  {label}</Text></View>
);
const Title = ({ children }: { children: React.ReactNode }) => <Text style={styles.title}>{children}</Text>;
const Sub = ({ children }: { children: React.ReactNode }) => <Text style={styles.sub}>{children}</Text>;
const Body = ({ children }: { children: React.ReactNode }) => <Text style={styles.bodyText}>{children}</Text>;
const B = ({ children }: { children: React.ReactNode }) => <Text style={styles.bold}>{children}</Text>;

// ═══════════════════════════════════════════════════════════
export default function World5Level2() {
  const completeLevel = useGameStore((s) => s.completeLevel);

  const [step, setStep] = useState(0);
  useReportProgress(step, TOTAL_STEPS);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const awarded = useRef<Set<number>>(new Set());

  // Pools por sesión
  const doerItems = useRef(pickN(DOER_POOL, 8)).current;
  const quizQ = useRef(pickN(QUIZ_POOL, 4).map(shuffleOpts)).current;
  const tfQ = useRef(pickN(TF_POOL, 5)).current;
  const ethicsItems = useRef(pickN(ETHICS_POOL, 5)).current;
  const replacedQ = useRef(pickN(REPLACED_POOL, 4).map(shuffleOpts)).current;
  const finalQ = useRef(pickN(FINAL_POOL, 6).map(shuffleOpts)).current;

  // Drag
  const [dragPlaced, setDragPlaced] = useState<{ [k: number]: 'bot' | 'pers' }>({});
  const [dragSel, setDragSel] = useState<number | null>(null);
  const [dragSolved, setDragSolved] = useState(false);
  const [dragFb, setDragFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const [dragFlash, setDragFlash] = useState<Set<number>>(new Set());
  const dragAttempts = useRef(0);

  // Sort
  const [sortOrder, setSortOrder] = useState<number[]>([]);
  const [sortSolved, setSortSolved] = useState(false);
  const [sortFb, setSortFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sortWrong, setSortWrong] = useState<Set<number>>(new Set());

  // Flow builder + builder day
  const [flowState, setFlowState] = useState<{ [k: string]: string }>({});
  const [builderDay, setBuilderDay] = useState<{ [k: string]: string }>({});

  // Quiz
  const [quizAnswers, setQuizAnswers] = useState<{ [k: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // Scenario
  const [scenarioSel, setScenarioSel] = useState<number | null>(null);
  const [scenarioChecked, setScenarioChecked] = useState(false);
  const scenarioOrder = useRef(shuffle(RESP_SCN.map((_, i) => i))).current;

  // TF
  const [tfAnswers, setTfAnswers] = useState<{ [k: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  // Ethics
  const [ethicsAnswers, setEthicsAnswers] = useState<{ [k: number]: 'ok' | 'cuest' | 'no' }>({});
  const [ethicsChecked, setEthicsChecked] = useState(false);

  // Connect
  const [connectAnswers, setConnectAnswers] = useState<{ [k: number]: number }>({});
  const [connectChecked, setConnectChecked] = useState(false);

  // Sprint (refs = fuente de verdad síncrona, evita cierres obsoletos)
  const [sprintSec, setSprintSec] = useState(90);
  const [sprintRunning, setSprintRunning] = useState(false);
  const [sprintDone, setSprintDone] = useState(false);
  const [sprintPicks, setSprintPicks] = useState<{ [k: number]: 'good' | 'bad' }>({});
  const [sprintFb, setSprintFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const spTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sprintPicksRef = useRef<{ [k: number]: 'good' | 'bad' }>({});
  const sprintDoneRef = useRef(false);

  // Reflexión
  const [reflectText, setReflectText] = useState('');
  const [reflectFb, setReflectFb] = useState<string | null>(null);

  const [expandedEx, setExpandedEx] = useState<number | null>(null);

  const isTheory = THEORY_STEPS.has(step);
  const currentQuiz = step === 8 ? quizQ : step === 15 ? replacedQ : step === 19 ? finalQ : null;
  const reflectMin = step === 18 ? 100 : 80;

  // Reset por paso (awarded persiste → evita doble XP con "Volver")
  useEffect(() => {
    setDragPlaced({}); setDragSel(null); setDragSolved(false); setDragFb(null); setDragFlash(new Set()); dragAttempts.current = 0;
    if (step === 7) setSortOrder(shuffledSort());
    setSortSolved(false); setSortFb(null); setSortWrong(new Set());
    setFlowState({}); setBuilderDay({});
    setQuizAnswers({}); setQuizChecked(false);
    setScenarioSel(null); setScenarioChecked(false);
    setTfAnswers({}); setTfChecked(false);
    setEthicsAnswers({}); setEthicsChecked(false);
    setConnectAnswers({}); setConnectChecked(false);
    if (spTimer.current) clearInterval(spTimer.current);
    sprintPicksRef.current = {}; sprintDoneRef.current = false;
    setSprintSec(90); setSprintRunning(false); setSprintDone(false); setSprintPicks({}); setSprintFb(null);
    setReflectText(''); setReflectFb(null);
    setExpandedEx(null);
  }, [step]);

  useEffect(() => { if (step === 12) startSprint(); /* eslint-disable-next-line */ }, [step]);

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

  function shuffledSort(): number[] {
    return shuffleDistinct([0, 1, 2, 3, 4, 5]);
  }

  // ── Drag ──
  const placeDrag = (zone: 'bot' | 'pers') => {
    if (dragSel === null || dragSolved) return;
    setDragPlaced((prev) => ({ ...prev, [dragSel]: zone })); setDragSel(null); setDragFb(null);
  };
  const removeDrag = (idx: number) => { if (dragSolved) return; setDragPlaced((prev) => { const n = { ...prev }; delete n[idx]; return n; }); };
  const checkDrag = () => {
    const placedCount = Object.keys(dragPlaced).length;
    if (placedCount < doerItems.length) { setDragFb({ ok: false, msg: `Faltan ${doerItems.length - placedCount} tarjetas. Toca un chip y luego la columna.` }); return; }
    dragAttempts.current += 1;
    const wrong: number[] = []; let correct = 0;
    doerItems.forEach((it, i) => { if (dragPlaced[i] === it.correct) correct++; else wrong.push(i); });
    if (correct === doerItems.length) {
      setDragSolved(true);
      const earned = dragAttempts.current === 1 ? 20 : 10;
      awardOnce(earned);
      setDragFb({ ok: true, msg: `¡Genial! ${doerItems.length} correctas. +${earned} XP 🎉${dragAttempts.current === 1 ? ' (¡primer intento!)' : ''}` });
    } else {
      setDragPlaced((prev) => { const n = { ...prev }; wrong.forEach((i) => delete n[i]); return n; });
      setDragFlash(new Set(wrong));
      setTimeout(() => setDragFlash(new Set()), 700);
      setDragFb({ ok: false, msg: `${correct} de ${doerItems.length} correctas. Las incorrectas vuelven al banco.` });
    }
  };

  // ── Sort ──
  const moveSort = (pos: number, dir: number) => {
    const np = pos + dir; if (np < 0 || np >= sortOrder.length || sortSolved) return;
    const no = [...sortOrder]; [no[pos], no[np]] = [no[np], no[pos]]; setSortOrder(no);
    setSortWrong(new Set()); setSortFb(null);
  };
  const checkSort = () => {
    const ok = sortOrder.every((v, i) => v === i);
    if (ok) { setSortSolved(true); awardOnce(15); setSortFb({ ok: true, msg: '¡Perfecto! Ese es el orden correcto. +15 XP 🎉' }); return; }
    const wrong = new Set(sortOrder.reduce<number[]>((acc, v, i) => { if (v !== i) acc.push(i); return acc; }, []));
    setSortWrong(wrong);
    setSortFb({ ok: false, msg: `${wrong.size} pasos fuera de lugar. Usa ▲▼ para ajustar.` });
    setTimeout(() => setSortWrong(new Set()), 2200);
  };

  // ── Builders (flow / day) ──
  const flowComplete = !!(flowState.trigger && flowState.middle && flowState.final);
  const dayComplete = BUILDER_DAY.rows.every((r) => builderDay[r.key]);

  // ── Quiz ──
  const checkQuiz = () => {
    if (!currentQuiz) return;
    setQuizChecked(true);
    let correct = 0;
    currentQuiz.forEach((q, i) => { if (quizAnswers[i] === q.correct) correct++; });
    awardOnce(correct * 8);
  };

  // ── Scenario ──
  const checkScenario = () => { if (scenarioSel === null) return; setScenarioChecked(true); if (RESP_SCN[scenarioSel].correct) awardOnce(12); };

  // ── TF ──
  const checkTF = () => { setTfChecked(true); let c = 0; tfQ.forEach((it, i) => { if (tfAnswers[i] === it.correct) c++; }); awardOnce(c * 5); };

  // ── Ethics ──
  const checkEthics = () => { setEthicsChecked(true); let c = 0; ethicsItems.forEach((it, i) => { if (ethicsAnswers[i] === it.correct) c++; }); awardOnce(c * 5); };

  // ── Connect ──
  const checkConnect = () => {
    setConnectChecked(true);
    let c = 0;
    CONNECT.questions.forEach((q, qi) => { if (connectAnswers[qi] === q.opts.findIndex((o) => o.ok)) c++; });
    awardOnce(c * 8);
  };

  // ── Sprint ──
  const startSprint = () => { sprintPicksRef.current = {}; sprintDoneRef.current = false; setSprintRunning(true); setSprintDone(false); setSprintSec(90); setSprintPicks({}); setSprintFb(null); };
  const pickSprint = (i: number) => {
    if (sprintDoneRef.current || sprintPicksRef.current[i] !== undefined) return;
    const good = SPRINT_POOL[i]; // note: SPRINT_POOL fixed order (10 items, no pickN)
    sprintPicksRef.current = { ...sprintPicksRef.current, [i]: good.good ? 'good' : 'bad' };
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
      ? { ok: true, msg: `¡Sprint logrado! ${good} buenas${bad > 0 ? ` (${bad} ${bad === 1 ? 'error' : 'errores'})` : ''}. +${earned} XP 🎉` }
      : { ok: false, msg: `${timeout ? '⏱ Tiempo agotado. ' : ''}Solo ${good} buenas (meta: ${SPRINT_META}). +${earned} XP` });
  };

  // ── Reflexión ──
  const sendReflection = (): boolean => {
    const t = reflectText.trim();
    if (t.length < reflectMin) { setReflectFb(`Escribe al menos ${reflectMin} caracteres (llevas ${t.length}).`); return false; }
    if (looksRandom(t)) { setReflectFb('Parece texto al azar. Escribe una idea real con tus propias palabras.'); return false; }
    if (!containsTopic(t)) { setReflectFb('Conéctalo con el tema: menciona tareas, automatización o qué delegarías (y qué no).'); return false; }
    setReflectFb(null);
    awardOnce(step === 2 ? 12 : 15);
    return true;
  };

  // ── Botón primario (un solo botón, cambia de fase) ──
  type Primary = { label: string; enabled: boolean; onPress: () => void; accent?: boolean };
  const advance = () => setStep((s) => s + 1);
  const getPrimary = (): Primary => {
    switch (step) {
      case 0: return { label: '¡Vamos! Empecemos 🚀', enabled: true, onPress: advance };
      case 1: return { label: 'Entendido, sigamos →', enabled: true, onPress: advance };
      case 4: case 5: case 13: return { label: 'Sigamos →', enabled: true, onPress: advance };
      case 2: case 16: case 18: return { label: 'Enviar reflexión →', enabled: reflectText.trim().length >= reflectMin, onPress: () => { if (sendReflection()) advance(); } };
      case 3: return dragSolved
        ? { label: 'Continuar →', enabled: true, onPress: advance }
        : { label: 'Verificar clasificación', enabled: Object.keys(dragPlaced).length > 0, onPress: checkDrag, accent: true };
      case 6: return { label: 'Terminar flujo →', enabled: flowComplete, onPress: () => { awardOnce(22); advance(); } };
      case 7: return sortSolved
        ? { label: 'Continuar →', enabled: true, onPress: advance }
        : { label: 'Verificar orden', enabled: true, onPress: checkSort, accent: true };
      case 8: case 15: case 19: return quizChecked
        ? { label: 'Ver resultado →', enabled: true, onPress: advance }
        : { label: 'Comprobar respuestas', enabled: !!currentQuiz && Object.keys(quizAnswers).length === currentQuiz.length, onPress: checkQuiz, accent: true };
      case 9: return scenarioChecked
        ? { label: 'Continuar →', enabled: true, onPress: advance }
        : { label: 'Verificar elección', enabled: scenarioSel !== null, onPress: checkScenario, accent: true };
      case 10: return tfChecked
        ? { label: 'Continuar →', enabled: true, onPress: advance }
        : { label: 'Comprobar', enabled: Object.keys(tfAnswers).length === tfQ.length, onPress: checkTF, accent: true };
      case 11: return ethicsChecked
        ? { label: 'Continuar →', enabled: true, onPress: advance }
        : { label: 'Verificar clasificación', enabled: Object.keys(ethicsAnswers).length === ethicsItems.length, onPress: checkEthics, accent: true };
      case 12: return { label: 'Continuar →', enabled: sprintDone, onPress: advance };
      case 14: return connectChecked
        ? { label: 'Continuar →', enabled: true, onPress: advance }
        : { label: 'Verificar flujo', enabled: Object.keys(connectAnswers).length === CONNECT.questions.length, onPress: checkConnect, accent: true };
      case 17: return { label: 'Terminar →', enabled: dayComplete, onPress: () => { awardOnce(BUILDER_DAY.xp); advance(); } };
      default: return { label: 'Continuar →', enabled: true, onPress: advance };
    }
  };

  const finishLevel = () => {
    const stars = xp >= 200 ? 3 : xp >= 125 ? 2 : 1; // máx real ~342 XP
    completeLevel(26, stars, xp);
    router.replace('/level/27');
  };

  // ── Sub-renders ──
  const renderExCard = (i: number, emoji: string, name: string, sub: string, how: React.ReactNode, fact: string) => {
    const open = expandedEx === i;
    return (
      <TouchableOpacity key={i} activeOpacity={0.9} style={[styles.exCard, open && styles.exCardOpen]} onPress={() => setExpandedEx(open ? null : i)}>
        <View style={styles.exHeader}>
          <View style={styles.exEmoji}><Text style={{ fontSize: 20 }}>{emoji}</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.exName}>{name}</Text>{!!sub && <Text style={styles.exSub}>{sub}</Text>}</View>
          <Text style={styles.exArrow}>{open ? '↓' : '›'}</Text>
        </View>
        {open && <View style={styles.exBody}><Text style={styles.exHow}>{how}</Text><View style={styles.exFact}><Text style={styles.exFactText}>{fact}</Text></View></View>}
      </TouchableOpacity>
    );
  };

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

  const renderReflect = (tag: string, question: React.ReactNode, placeholder: string, xpLbl: string) => (
    <View>
      <Tag icon="✍️" label={`${tag} · ${xpLbl}`} variant="reflect" />
      <Title>Piensa tú</Title>
      <Sub>No hay respuesta correcta. Procesa lo aprendido con tus palabras.</Sub>
      <View style={[styles.card, styles.cardPurple]}><Text style={styles.cardTitle}>🤔  Tu pregunta</Text><Text style={styles.cardText}>{question}</Text></View>
      <TextInput style={styles.reflectArea} multiline value={reflectText} onChangeText={(t) => { setReflectText(t); if (reflectFb) setReflectFb(null); }} placeholder={placeholder} placeholderTextColor="#b8bcc0" />
      <Text style={styles.charCount}>{reflectText.trim().length} / {reflectMin} mínimo</Text>
      {reflectFb && <View style={[styles.fb, styles.fbBad]}><Text style={styles.fbBadText}>{reflectFb}</Text></View>}
    </View>
  );

  const renderBuilderPreview = (rows: { key: string; label: string }[], state: { [k: string]: string }, header: string) => (
    <>
      <Text style={[styles.builderLabel, { marginTop: 12, marginBottom: 4 }]}>{header}</Text>
      <View style={styles.codeBox}>
        {rows.map((r) => (
          <Text key={r.key} style={styles.codeLine}>
            <Text style={styles.codeKey}>{r.label.replace(/^[^\wÁÉÍÓÚáéíóúÑñ]*\s*/, '').split('(')[0].trim()}: </Text>
            {state[r.key] ? <Text style={styles.codeText}>{state[r.key]}</Text> : <Text style={styles.codeEmpty}>elige una opción</Text>}
          </Text>
        ))}
      </View>
    </>
  );

  // ── Render de contenido ──
  const renderContent = () => {
    switch (step) {
      case 0: return (
        <View>
          <View style={styles.introIcon}><Text style={{ fontSize: 34 }}>⚡</Text></View>
          <Tag icon="✨" label="Nivel 26 · Mundo 5" variant="intro" />
          <Title>Haz que la IA Trabaje Sola</Title>
          <Sub>Aprende a delegar lo repetitivo. Al terminar vas a ver oportunidades de automatización por todas partes — y vas a saber construirlas paso a paso.</Sub>
          <View style={[styles.card, styles.cardAccent]}><Text style={styles.cardTitle}>📚  Qué vas a aprender</Text><Text style={styles.cardText}>Qué es automatizar y la fórmula trigger→acción · Zapier, Make, n8n · Cuándo usar cada uno · Ética: qué SÍ y qué NO automatizar · Flujos con IA</Text></View>
          <View style={[styles.card, styles.cardGreen]}><Text style={styles.cardTitle}>⚡  Qué podrás HACER al terminar</Text><Text style={styles.cardText}>Diseñar flujos completos de automatización con disparador + IA + acción final, para tu vida personal y profesional.</Text></View>
          <View style={[styles.card, styles.cardYellow]}><Text style={styles.cardTitle}>🎮  19 módulos · 45-60 min · hasta 230 XP</Text><Text style={styles.cardText}>📖 Teoría · ✍️ Reflexión · 🧩 Persona vs robot · ⚡ Zapier · 🔀 Make · ⚡ Flow Builder · ↕️ Sort · ❓ Quiz · ⚖️ Escenarios · ✅ V/F · 🛡️ Ética · ⏱ Sprint · 🔧 n8n · 🔗 Connect · 🛠️ Día automatizado</Text></View>
        </View>
      );
      case 1: return (
        <View>
          <Tag icon="📖" label="Módulo 1 de 19 · Teoría" variant="theory" />
          <Title>¿Qué es automatizar?</Title>
          <Body>La <B>automatización</B> es diseñar sistemas que ejecuten tareas por ti. No siempre con IA — una macro de Excel ya es una automatización. Pero combinando IA + automatización puedes delegar el 80% de lo repetitivo y liberar tiempo para crear, pensar y decidir.</Body>
          <View style={styles.highlightBox}><Text style={styles.highlightText}>💡 <B>La fórmula mágica:</B> CUANDO pase X → HAZ Y → RESULTADO Z. Ejemplo: cuando llegue email con 'factura' → guárdalo en Drive → carpeta siempre ordenada sin tocar nada.</Text></View>
          <Body>La automatización no reemplaza tu juicio. <B>Reemplaza tus dedos.</B> Copiar, pegar, reenviar, recordar — esas microtareas se delegan. Tú te quedas con lo que sí requiere tu cerebro.</Body>
          <Text style={styles.sectionTitle}>🛠️ Las 3 herramientas a conocer</Text>
          {[['1', 'Zapier:', 'la más popular. Lineal, simple, miles de apps. Ideal si empiezas.'], ['2', 'Make:', 'editor visual tipo diagrama. Más potente para flujos con bifurcaciones.'], ['3', 'n8n:', 'open source, autohosteable. Para equipos técnicos con control total.']].map(([n, t, d]) => (
            <View key={n} style={styles.stepLi}><View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View><Text style={styles.stepLiText}><B>{t}</B> {d}</Text></View>
          ))}
          <View style={styles.tipBox}><Text style={styles.tipText}>✅ <B>Mentalidad clave:</B> no preguntes '¿cómo hago esto más rápido?'. Pregunta: '¿cómo hago que esto pase solo?'.</Text></View>
        </View>
      );
      case 2: return renderReflect('Reflexión inicial', <Text>Piensa en tu semana: <B>¿qué 5 tareas haces manualmente que te gustaría que pasaran solas?</B> Pueden ser pequeñas (enviar el link de la clase) o grandes (resumir libros del colegio). No filtres — lista 5 en bruto.</Text>, '1. Enviar el link de la clase al grupo cada lunes. 2. Resumir los PDFs del colegio...', '+12 XP');
      case 3: {
        const cols = (['bot', 'pers'] as const).map((zone) => {
          const placedHere = Object.keys(dragPlaced).map(Number).filter((k) => dragPlaced[k] === zone);
          const hasItem = placedHere.length > 0;
          return (
            <TouchableOpacity key={zone} activeOpacity={0.9} disabled={dragSel === null || dragSolved} style={[styles.dropCol, zone === 'bot' ? (hasItem && styles.dropColBotFull) : (hasItem && styles.dropColPersFull)]} onPress={() => placeDrag(zone)}>
              <View style={[styles.dropHeader, zone === 'bot' ? styles.dropHeaderBot : styles.dropHeaderPers]}>
                <Text style={[styles.dropHeaderText, { color: zone === 'bot' ? P.cyanText : P.pinkText }]}>{zone === 'bot' ? '🤖 Robot' : '🧑 Persona'}</Text>
              </View>
              <View style={styles.dropArea}>
                {placedHere.map((k) => (
                  <TouchableOpacity key={k} disabled={dragSolved} onPress={() => removeDrag(k)} style={[styles.dropChip, zone === 'bot' ? styles.dropChipBot : styles.dropChipPers]}>
                    <Text style={[styles.dropChipText, { color: zone === 'bot' ? P.cyanText : P.pinkText }]}>{doerItems[k].text}  ✕</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          );
        });
        return (
          <View>
            <Tag icon="🧩" label="Módulo 3 de 19 · Clasificar" variant="activity" />
            <Title>¿Lo hace persona o robot?</Title>
            <Sub>8 tareas reales. Clasifica: ¿automatizable (robot) o requiere humano (persona)? Toca un chip y luego la columna.</Sub>
            <View style={styles.chipsPool}>
              {doerItems.map((it, i) => dragPlaced[i] === undefined && (
                <TouchableOpacity key={i} disabled={dragSolved} style={[styles.chip, dragSel === i && styles.chipSel, dragFlash.has(i) && styles.chipFlash]} onPress={() => setDragSel(dragSel === i ? null : i)}>
                  <Text style={[styles.chipText, dragSel === i && { color: P.cyanText }]}>{it.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.dropCols}>{cols}</View>
            {dragFb && <View style={[styles.fb, dragFb.ok ? styles.fbOk : styles.fbBad]}><Text style={dragFb.ok ? styles.fbOkText : styles.fbBadText}>{dragFb.msg}</Text></View>}
          </View>
        );
      }
      case 4: return (
        <View>
          <Tag icon="⚡" label="Módulo 4 de 19 · Casos Zapier" variant="example" />
          <Title>Zapier · Conecta apps sin código</Title>
          <Sub>Demo: 'cuando llega un email → guarda en Notion'. 3 casos reales. Toca cada tarjeta 👆</Sub>
          {renderExCard(0, '⚡', 'Zapier · El pionero de no-code', 'Cuando llega X, haz Y', <Text>Zapier conecta <B>5.000+ apps</B> con lógica 'cuando X → haz Y'. Eliges trigger, eliges acción, listo. Ej: 'cuando llega email de mi jefe, envíame WhatsApp'.</Text>, '⭐ Procesa 100M+ automatizaciones/día. Plan gratuito suficiente para empezar.')}
          {renderExCard(1, '📧', 'Zapier · Caso real: email → Notion', 'Guarda facturas automáticamente', <Text>Paso 1: Gmail trigger ('llega email con asunto <B>factura</B>'). Paso 2: Drive ('guarda adjunto'). Paso 3: Notion ('crea página con fecha y remitente').</Text>, '⭐ Un flujo de 3 pasos que ahorra ~15 minutos/día a quien factura mensualmente.')}
          {renderExCard(2, '🚀', 'Zapier · Ejemplo educativo', 'Recordatorio de tareas', <Text>Trigger: Google Forms ('alumno envía tarea'). Acción: Calendar ('recordatorio 24h antes'). Acción: Slack ('avisa al grupo').</Text>, '⭐ Los colegios que lo usan reportan -40% tareas entregadas tarde.')}
        </View>
      );
      case 5: return (
        <View>
          <Tag icon="🔀" label="Módulo 5 de 19 · Casos Make" variant="example" />
          <Title>Make + agendas inteligentes</Title>
          <Sub>Editor visual con bifurcaciones. Cal.ai y Reclaim que piensan solos. Toca cada tarjeta 👆</Sub>
          {renderExCard(0, '🔀', 'Make (ex Integromat) · Visual con diagramas', 'Editor tipo diagrama con nodos', <Text>Make es visual: dibujas un <B>diagrama con nodos conectados</B>. Perfecto para lógica compleja: 'si email de cliente VIP → Slack; si email normal → archiva'.</Text>, '⭐ Más barato por volumen. Ideal cuando tu flujo pasa de 3 a 7+ pasos con bifurcaciones.')}
          {renderExCard(1, '🌳', 'Make · Clasificador inteligente', 'Un email, dos rutas', <Text>Trigger: email entrante. Router: la IA lo clasifica como <B>'urgente' vs 'normal'</B>. Rama 1: SMS si urgente. Rama 2: archiva en 'revisar luego'.</Text>, '⭐ Separar la decisión en el flujo reduce errores 70% vs. hacerlo manualmente.')}
          {renderExCard(2, '📅', 'Cal.ai & Reclaim · Agendas que piensan solas', 'IA que agenda por ti', <Text>Cal.ai negocia por ti: cliente pide reunión → la IA revisa tu calendario, tu energía y tus zonas horarias, y <B>devuelve 3 opciones reales</B>.</Text>, '⭐ Quienes lo usan reportan ~5h/semana ahorradas solo en coordinar reuniones.')}
        </View>
      );
      case 6: {
        const nodes = [
          { key: 'trigger', icon: '⚡', title: 'Disparador', empty: 'Elige un evento abajo', opts: FLOW_CFG.trigger },
          { key: 'middle', icon: '🤖', title: 'Paso con IA', empty: 'Elige qué hace la IA', opts: FLOW_CFG.middle },
          { key: 'final', icon: '📦', title: 'Acción final', empty: 'Elige el resultado', opts: FLOW_CFG.final },
        ];
        return (
          <View>
            <Tag icon="⚡" label="Módulo 6 de 19 · Flow Builder" variant="build" />
            <Title>La fórmula: cuando X → hace Y</Title>
            <Sub>Diseña tu primera automatización: disparador + acción intermedia con IA + resultado.</Sub>
            <View style={styles.flowWrap}>
              {nodes.map((n, ni) => (
                <View key={n.key}>
                  <View style={styles.flowNode}>
                    <View style={styles.flowIco}><Text style={{ fontSize: 17 }}>{n.icon}</Text></View>
                    <View style={{ flex: 1 }}><Text style={styles.flowNodeTitle}>{n.title}</Text><Text style={[styles.flowNodeText, !flowState[n.key] && styles.flowNodeEmpty]}>{flowState[n.key] || n.empty}</Text></View>
                  </View>
                  {ni < 2 && <Text style={styles.flowArrow}>↓</Text>}
                </View>
              ))}
            </View>
            {nodes.map((n) => (
              <View key={n.key} style={{ marginTop: 10 }}>
                <Text style={styles.builderLabel}>{n.title}</Text>
                <View style={styles.flowPicker}>
                  {n.opts.map((o) => (
                    <TouchableOpacity key={o} style={[styles.flowPick, flowState[n.key] === o && styles.flowPickSel]} onPress={() => setFlowState((prev) => ({ ...prev, [n.key]: o }))}>
                      <Text style={[styles.flowPickText, flowState[n.key] === o && styles.flowPickTextSel]}>{o}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>
        );
      }
      case 7: return (
        <View>
          <Tag icon="↕️" label="Módulo 7 de 19 · Ordenar" variant="activity" />
          <Title>Los 6 pasos para diseñar un flujo</Title>
          <Sub>Ordena del 1 al 6 cómo se construye una automatización profesional.</Sub>
          {sortOrder.map((itemIdx, pos) => {
            const [label, ...rest] = SORT_FLOW[itemIdx].split(':');
            return (
              <View key={pos} style={[styles.sortItem, sortWrong.has(pos) && styles.sortItemWrong, sortSolved && styles.sortItemOk]}>
                <View style={styles.sortNum}><Text style={styles.sortNumText}>{pos + 1}</Text></View>
                <Text style={styles.sortText}><B>{label}:</B>{rest.join(':')}</Text>
                <View style={styles.sortArrows}>
                  <TouchableOpacity disabled={pos === 0 || sortSolved} style={[styles.sortBtn, (pos === 0 || sortSolved) && styles.sortBtnOff]} onPress={() => moveSort(pos, -1)}><Text style={styles.sortBtnText}>▲</Text></TouchableOpacity>
                  <TouchableOpacity disabled={pos === sortOrder.length - 1 || sortSolved} style={[styles.sortBtn, (pos === sortOrder.length - 1 || sortSolved) && styles.sortBtnOff]} onPress={() => moveSort(pos, 1)}><Text style={styles.sortBtnText}>▼</Text></TouchableOpacity>
                </View>
              </View>
            );
          })}
          {sortFb && <View style={[styles.fb, sortFb.ok ? styles.fbOk : styles.fbBad]}><Text style={sortFb.ok ? styles.fbOkText : styles.fbBadText}>{sortFb.msg}</Text></View>}
        </View>
      );
      case 8: return renderQuiz(quizQ, 'Módulo 8 de 19 · Quiz', 'Quiz · Conceptos de automatización', '4 preguntas sobre triggers, acciones y herramientas.');
      case 9: return (
        <View>
          <Tag icon="🎯" label="Módulo 9 de 19 · Escenario" variant="case" />
          <Title>Si alguien me escribe → IA responde</Title>
          <View style={styles.scenarioBox}><Text style={styles.scenarioLabel}>🎬 LA SITUACIÓN</Text><Text style={styles.scenarioText}>4 situaciones donde un sistema podría responder en tu nombre. ¿Cuál es éticamente aceptable?</Text></View>
          <Sub><B>Elige la opción correcta</B></Sub>
          {scenarioOrder.map((idx, pos) => {
            const c = RESP_SCN[idx];
            const showOk = scenarioChecked && c.correct;
            const showWrong = scenarioChecked && scenarioSel === idx && !c.correct;
            return (
              <TouchableOpacity key={pos} disabled={scenarioChecked}
                style={[styles.scChoice, scenarioSel === idx && !scenarioChecked && styles.scChoiceSel, showOk && styles.scChoiceOk, showWrong && styles.scChoiceWrong]}
                onPress={() => setScenarioSel(idx)}>
                <Text style={styles.scTitle}>{c.title}</Text>
                <Text style={styles.scText}>{c.text}</Text>
              </TouchableOpacity>
            );
          })}
          {scenarioChecked && scenarioSel !== null && (
            <View style={[styles.fb, RESP_SCN[scenarioSel].correct ? styles.fbOk : styles.fbBad]}>
              <Text style={RESP_SCN[scenarioSel].correct ? styles.fbOkText : styles.fbBadText}>
                {RESP_SCN[scenarioSel].correct ? `✅ ¡Correcto! ${RESP_SCN[scenarioSel].explain}` : `❌ ${RESP_SCN[scenarioSel].explain}`}
              </Text>
            </View>
          )}
        </View>
      );
      case 10: return (
        <View>
          <Tag icon="✅" label="Módulo 10 de 19 · Verdadero o Falso" variant="activity" />
          <Title>Errores de automatización</Title>
          <Sub>5 afirmaciones sobre lo que puede salir mal. ¿Cuáles son verdad?</Sub>
          {tfQ.map((it, i) => {
            const ans = tfAnswers[i];
            return (
              <View key={i} style={styles.tfSet}>
                <Text style={styles.tfQ}>{i + 1}. {it.stmt}</Text>
                <View style={styles.tfOpts}>
                  <TouchableOpacity disabled={tfChecked} style={[styles.tfBtn, ans === true && !tfChecked && styles.tfBtnTrue, tfChecked && it.correct === true && styles.tfBtnCorrect, tfChecked && ans === true && !it.correct && styles.tfBtnWrong]} onPress={() => setTfAnswers((prev) => ({ ...prev, [i]: true }))}><Text style={styles.tfBtnText}>✅ Verdadero</Text></TouchableOpacity>
                  <TouchableOpacity disabled={tfChecked} style={[styles.tfBtn, ans === false && !tfChecked && styles.tfBtnFalse, tfChecked && it.correct === false && styles.tfBtnCorrect, tfChecked && ans === false && it.correct && styles.tfBtnWrong]} onPress={() => setTfAnswers((prev) => ({ ...prev, [i]: false }))}><Text style={styles.tfBtnText}>❌ Falso</Text></TouchableOpacity>
                </View>
                {tfChecked && (
                  <View style={[styles.fb, ans === it.correct ? styles.fbOk : styles.fbBad]}>
                    <Text style={ans === it.correct ? styles.fbOkText : styles.fbBadText}>{ans === it.correct ? '✅ Correcto. ' : `❌ Incorrecto. La respuesta correcta es "${it.correct ? 'Verdadero' : 'Falso'}". `}{it.explain}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      );
      case 11: return (
        <View>
          <Tag icon="⚖️" label="Módulo 11 de 19 · Clasificador ético" variant="case" />
          <Title>Automatización + Ética</Title>
          <Sub>Clasifica cada caso: aceptable, cuestionable o inaceptable. Guíate por tu intuición ética.</Sub>
          {ethicsItems.map((it, i) => {
            const ans = ethicsAnswers[i];
            const opts: { k: 'ok' | 'cuest' | 'no'; label: string }[] = [{ k: 'ok', label: '✅ Aceptable' }, { k: 'cuest', label: '⚠️ Cuestionable' }, { k: 'no', label: '❌ Inaceptable' }];
            return (
              <View key={i} style={styles.ethicsCard}>
                <Text style={styles.ethicsText}><B>{i + 1}.</B> {it.text}</Text>
                <View style={styles.ethicsOpts}>
                  {opts.map((o) => {
                    const showOk = ethicsChecked && it.correct === o.k;
                    const showWrong = ethicsChecked && ans === o.k && it.correct !== o.k;
                    return (
                      <TouchableOpacity key={o.k} disabled={ethicsChecked} style={[styles.ethicsOpt, ans === o.k && !ethicsChecked && styles.ethicsOptSel, showOk && styles.ethicsOptOk, showWrong && styles.ethicsOptWrong]} onPress={() => setEthicsAnswers((prev) => ({ ...prev, [i]: o.k }))}>
                        <Text style={[styles.ethicsOptText, ans === o.k && !ethicsChecked && { color: P.cyanText }, showOk && { color: P.greenText }, showWrong && { color: P.redText }]}>{o.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {ethicsChecked && (
                  <View style={[styles.fb, ans === it.correct ? styles.fbOk : styles.fbBad, { marginTop: 8 }]}>
                    <Text style={ans === it.correct ? styles.fbOkText : styles.fbBadText}>{ans === it.correct ? '✓ ' : '✗ '}{it.explain}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      );
      case 12: return (
        <View>
          <Tag icon="⏱" label="Módulo 12 de 19 · Sprint 90s" variant="sprint" />
          <Title>Sprint: ¿buena o mala automatización?</Title>
          <Sub>90 segundos. Toca solo las BUENAS (evita las malas). Meta: {SPRINT_META} buenas.</Sub>
          <View style={styles.sprintBox}>
            <View style={styles.sprintTimerRow}>
              <Text style={[styles.sprintTime, sprintSec <= 10 && { color: P.red }]}>{Math.floor(sprintSec / 60)}:{String(sprintSec % 60).padStart(2, '0')}</Text>
              <Text style={styles.sprintLabel}>{sprintDone ? 'Sprint terminado' : `Meta: ${SPRINT_META} buenos · ${Object.values(sprintPicks).filter((v) => v === 'good').length} logrados`}</Text>
            </View>
            {SPRINT_POOL.map((it, i) => {
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
      case 13: return (
        <View>
          <Tag icon="🔧" label="Módulo 13 de 19 · Casos n8n" variant="example" />
          <Title>n8n · Open source y para los más curiosos</Title>
          <Sub>Cuando necesitas control total y privacidad estricta. Toca cada tarjeta 👆</Sub>
          {renderExCard(0, '🔧', 'n8n · Open source y autohosteable', 'Control total, privacidad completa', <Text>n8n es para quienes quieren <B>control total</B>. Lo instalas en tu propio servidor, no depende de nadie y puedes modificar el código.</Text>, '⭐ Popular en equipos técnicos y empresas europeas (GDPR). Requiere más conocimiento técnico.')}
          {renderExCard(1, '🔐', 'n8n · Equipo de salud con datos sensibles', 'Privacidad médica', <Text>Un equipo médico usa n8n autohosteado: <B>los datos nunca salen de su servidor</B>. Flujos con historias clínicas imposibles en Zapier por regulación.</Text>, '⭐ En industrias reguladas (salud, banca, legal), n8n es la única opción viable.')}
          {renderExCard(2, '💡', 'n8n · Nodos visuales + código', 'Flexibilidad híbrida', <Text>En n8n puedes mezclar nodos visuales con <B>JavaScript embebido</B> cuando necesitas lógica que no existe como nodo predefinido.</Text>, "⭐ La escapa del 'no-code puro': 90% visual + 10% código cuando de verdad hace falta.")}
        </View>
      );
      case 14: return (
        <View>
          <Tag icon="🔗" label="Módulo 14 de 19 · Conecta apps" variant="build" />
          <Title>Conecta Gmail + IA + Notion</Title>
          <View style={styles.scenarioBox}><Text style={styles.scenarioLabel}>🎬 ESCENARIO</Text><Text style={styles.scenarioText}>{CONNECT.scenario}</Text></View>
          {CONNECT.questions.map((q, qi) => {
            const okIdx = q.opts.findIndex((o) => o.ok);
            return (
              <View key={qi} style={{ marginBottom: 12 }}>
                <Text style={styles.builderLabel}>{q.label}</Text>
                <View style={styles.flowPicker}>
                  {q.opts.map((o, oi) => {
                    const sel = connectAnswers[qi] === oi;
                    const showOk = connectChecked && oi === okIdx;
                    const showWrong = connectChecked && sel && oi !== okIdx;
                    return (
                      <TouchableOpacity key={oi} disabled={connectChecked} style={[styles.flowPick, sel && !connectChecked && styles.flowPickSel, showOk && styles.flowPickOk, showWrong && styles.flowPickWrong]} onPress={() => setConnectAnswers((prev) => ({ ...prev, [qi]: oi }))}>
                        <Text style={[styles.flowPickText, sel && !connectChecked && styles.flowPickTextSel, showOk && { color: P.greenText }, showWrong && { color: P.redText }]}>{o.t}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
          {connectChecked && (
            <View style={[styles.fb, styles.fbOk]}><Text style={styles.fbOkText}>✓ Flujo correcto: Gmail (trigger) → IA resume → Notion (acción final). Así se conecta cualquier app.</Text></View>
          )}
        </View>
      );
      case 15: return renderQuiz(replacedQ, 'Módulo 15 de 19 · Quiz', 'El trabajo que la IA ya hace solo', 'Áreas reales donde la automatización ya reemplazó tareas humanas.');
      case 16: return renderReflect('Reflexión ética', <Text>Automatizar hace tu vida más fácil, pero cruza una línea si sustituye <B>decisiones humanas</B> importantes. ¿Cuáles serían TUS 3 reglas personales sobre qué automatizarás y qué jamás le delegarás a un sistema?</Text>, 'Mis 3 reglas: 1) Nunca automatizaré respuestas a personas en duelo. 2) Siempre revisaré antes de enviar...', '+15 XP');
      case 17: return (
        <View>
          <Tag icon="🛠️" label="Módulo 17 de 19 · Builder" variant="build" />
          <Title>Diseña tu día automatizado</Title>
          <Sub>Mañana, tarde y noche: 3 flujos que harían tu día más simple.</Sub>
          <View style={styles.builderWrap}>
            {BUILDER_DAY.rows.map((r) => (
              <View key={r.key} style={styles.builderRow}>
                <Text style={styles.builderLabel}>{r.label}</Text>
                <View style={styles.builderOpts}>
                  {r.opts.map((o) => (
                    <TouchableOpacity key={o} style={[styles.builderOpt, builderDay[r.key] === o && styles.builderOptSel]} onPress={() => setBuilderDay((prev) => ({ ...prev, [r.key]: o }))}>
                      <Text style={[styles.builderOptText, builderDay[r.key] === o && styles.builderOptTextSel]}>{o}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>
          {renderBuilderPreview(BUILDER_DAY.rows, builderDay, 'Tu día automatizado:')}
        </View>
      );
      case 18: return renderReflect('Reflexión creatividad', <Text>La IA puede automatizar mucho de tu proceso creativo: referencias, variaciones, borradores. Pero hay algo que no puede sustituirse — decidir qué vale la pena crear y por qué. <B>¿Qué parte de tu proceso creativo automatizarías HOY mismo — y qué parte jamás le delegarías a una máquina?</B></Text>, 'Automatizaría... Pero jamás le delegaría... porque...', '+15 XP');
      case 19: return renderQuiz(finalQ, 'Módulo 19 de 19 · Quiz', 'Quiz final · Automatización', '6 preguntas avanzadas. Demuestra todo lo aprendido.');
      case 20: {
        const pct = Math.round((26 / 36) * 100);
        return (
          <View style={styles.completeContainer}>
            <View style={styles.completeBadge}><Text style={{ fontSize: 44 }}>⚡</Text></View>
            <Text style={styles.completeTitle}>¡Nivel 26 completado!</Text>
            <Text style={styles.completeSub}>Terminaste "Haz que la IA Trabaje Sola". Ahora eres Automation Engineer.</Text>
            <View style={styles.xpEarned}><Text style={styles.xpEarnedText}>⭐ {xp} XP ganados en este nivel</Text></View>
            <View style={styles.skillsList}>
              {['Puedo identificar qué tareas de mi día son automatizables y cuáles no', 'Conozco Zapier, Make y n8n y sé cuándo usar cada uno', 'Sé diseñar flujos: disparador → acción con IA → resultado', 'Entiendo qué NO debería automatizarse nunca (ética)', 'Puedo conectar al menos 3 apps (Gmail + IA + Notion) en un flujo real'].map((s, i) => (
                <View key={i} style={styles.skillRow}><Text style={styles.skillCheck}>✓</Text><Text style={styles.skillText}>{s}</Text></View>
              ))}
            </View>
            <View style={styles.nextHint}><Text style={styles.nextHintText}><B>Nivel 27: Tu Idea para Cambiar Algo</B>{'\n'}Ya sabes automatizar. Siguiente paso: identificar un problema real de tu entorno que valga la pena resolver. De usuario de apps a creador de soluciones.</Text></View>
            <View style={styles.lvlBarWrap}>
              <Text style={styles.lvlBarLabel}>Nivel 26 de 36 completado · {pct}% del camino</Text>
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
  fill: { height: '100%', backgroundColor: P.cyan, borderRadius: 4 },
  xpChip: { ...typography.bold, fontSize: 13, color: '#854d0e', backgroundColor: '#fde68a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  progLabel: { ...typography.regular, fontSize: 11, color: P.faint, textAlign: 'center', paddingTop: 6 },
  scrollContent: { padding: 16, paddingBottom: 30 },

  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 11, fontWeight: '700' },

  introIcon: { width: 68, height: 68, borderRadius: 20, backgroundColor: P.cyanBg, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  title: { ...typography.extraBold, fontSize: 20, color: P.ink, marginBottom: 8, lineHeight: 26 },
  sub: { ...typography.regular, fontSize: 13, color: P.muted, lineHeight: 20, marginBottom: 12 },
  bodyText: { ...typography.regular, fontSize: 13, color: P.body, lineHeight: 22, marginBottom: 12 },
  bold: { fontWeight: '700', color: P.ink },
  sectionTitle: { ...typography.bold, fontSize: 14, color: P.ink, marginTop: 10, marginBottom: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },

  card: { backgroundColor: P.cardBg, borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: P.border },
  cardAccent: { backgroundColor: P.cyanBg, borderColor: P.cyanBorder },
  cardGreen: { backgroundColor: P.greenSoft, borderColor: P.greenBorder },
  cardYellow: { backgroundColor: P.yellowBg, borderColor: P.yellowBorder },
  cardPurple: { backgroundColor: P.purpleBg, borderColor: P.purpleBorder },
  cardTitle: { ...typography.bold, fontSize: 13, color: P.ink, marginBottom: 4 },
  cardText: { ...typography.regular, fontSize: 13, color: P.body, lineHeight: 21 },

  highlightBox: { borderLeftWidth: 3, borderLeftColor: P.cyan, backgroundColor: P.cyanBg, borderRadius: 8, padding: 12, marginBottom: 12 },
  highlightText: { fontSize: 13, color: P.cyanText, lineHeight: 21 },
  tipBox: { borderLeftWidth: 3, borderLeftColor: P.green, backgroundColor: P.greenSoft, borderRadius: 8, padding: 12, marginTop: 4 },
  tipText: { fontSize: 13, color: P.greenText, lineHeight: 21 },
  stepLi: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 9 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: P.cyan, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepLiText: { flex: 1, fontSize: 13, color: P.body, lineHeight: 20 },

  chipsPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, padding: 10, backgroundColor: P.cardBg, borderRadius: 14, borderWidth: 1, borderColor: P.border, marginBottom: 10, minHeight: 54 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff' },
  chipSel: { borderColor: P.cyan, backgroundColor: P.cyanBg },
  chipFlash: { borderColor: '#fca5a5', backgroundColor: P.redBg },
  chipText: { fontSize: 12, color: P.body, lineHeight: 16 },
  dropCols: { flexDirection: 'row', gap: 8 },
  dropCol: { flex: 1, borderRadius: 12, borderWidth: 2, borderColor: '#d1d5db', borderStyle: 'dashed', minHeight: 110, padding: 8, backgroundColor: '#fafafa' },
  dropColBotFull: { borderStyle: 'solid', borderColor: P.cyanBorder, backgroundColor: P.cyanBg },
  dropColPersFull: { borderStyle: 'solid', borderColor: '#fbcfe8', backgroundColor: P.pinkBg },
  dropHeader: { paddingVertical: 5, borderRadius: 7, marginBottom: 7 },
  dropHeaderBot: { backgroundColor: P.cyanBg },
  dropHeaderPers: { backgroundColor: P.pinkBg },
  dropHeaderText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  dropArea: { gap: 5 },
  dropChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  dropChipBot: { backgroundColor: P.botChip },
  dropChipPers: { backgroundColor: P.pinkBg },
  dropChipText: { fontSize: 11, fontWeight: '500', lineHeight: 15 },

  sortItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: P.cardBg, borderRadius: 12, borderWidth: 1.5, borderColor: P.border, marginBottom: 7 },
  sortItemOk: { borderColor: '#86efac', backgroundColor: P.greenSoft },
  sortItemWrong: { borderColor: '#fca5a5', backgroundColor: P.redBg },
  sortNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: P.cyan, alignItems: 'center', justifyContent: 'center' },
  sortNumText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  sortText: { flex: 1, fontSize: 12, color: P.body, lineHeight: 17 },
  sortArrows: { gap: 3 },
  sortBtn: { width: 30, height: 26, borderRadius: 7, borderWidth: 1, borderColor: P.border, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  sortBtnOff: { opacity: 0.25 },
  sortBtnText: { fontSize: 11, color: P.muted },

  flowWrap: { backgroundColor: P.flowBg, borderWidth: 1, borderColor: P.flowBorder, borderRadius: 14, padding: 12, marginBottom: 4 },
  flowNode: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#fff', borderWidth: 2, borderColor: P.cyan, borderRadius: 10, padding: 10 },
  flowIco: { width: 32, height: 32, borderRadius: 8, backgroundColor: P.cyanBg, alignItems: 'center', justifyContent: 'center' },
  flowNodeTitle: { fontSize: 11, color: P.cyanText, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  flowNodeText: { fontSize: 12, color: P.body, lineHeight: 17, fontWeight: '500' },
  flowNodeEmpty: { fontStyle: 'italic', color: '#94a3b8', fontWeight: '400' },
  flowArrow: { textAlign: 'center', color: P.cyan, fontSize: 18, fontWeight: '700', marginVertical: 1 },
  flowPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  flowPick: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff' },
  flowPickSel: { borderColor: P.cyan, backgroundColor: P.cyanBg },
  flowPickOk: { borderColor: P.green, backgroundColor: P.greenBg },
  flowPickWrong: { borderColor: P.red, backgroundColor: P.redBg },
  flowPickText: { fontSize: 11, color: P.body },
  flowPickTextSel: { color: P.cyanText, fontWeight: '700' },

  builderWrap: { gap: 10 },
  builderRow: { backgroundColor: P.cardBg, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 11 },
  builderLabel: { fontSize: 11, fontWeight: '700', color: P.cyanText, marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' },
  builderOpts: { gap: 5 },
  builderOpt: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff' },
  builderOptSel: { borderColor: P.cyan, backgroundColor: P.cyanBg },
  builderOptText: { fontSize: 12, color: P.body, fontWeight: '500', lineHeight: 16 },
  builderOptTextSel: { color: P.cyanText, fontWeight: '700' },
  codeBox: { backgroundColor: P.codeBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1e293b' },
  codeLine: { fontSize: 12, lineHeight: 20, marginBottom: 2 },
  codeText: { color: P.codeText, fontFamily: 'monospace' },
  codeKey: { color: P.codeKey, fontWeight: '700', fontFamily: 'monospace' },
  codeEmpty: { color: P.codeEmpty, fontStyle: 'italic', fontFamily: 'monospace' },

  scenarioBox: { backgroundColor: '#fffbeb', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: P.yellowBorder },
  scenarioLabel: { fontSize: 10, fontWeight: '700', color: P.amberText, marginBottom: 8, letterSpacing: 0.7 },
  scenarioText: { fontSize: 13, color: P.body, lineHeight: 21 },
  scChoice: { borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: P.border, marginBottom: 8, backgroundColor: '#fff' },
  scChoiceSel: { borderColor: P.cyan, backgroundColor: P.cyanBg },
  scChoiceOk: { borderColor: P.green, backgroundColor: P.greenSoft },
  scChoiceWrong: { borderColor: P.red, backgroundColor: P.redBg },
  scTitle: { fontSize: 12, fontWeight: '700', color: P.ink, marginBottom: 4 },
  scText: { fontSize: 12, color: P.body, lineHeight: 17 },

  quizQ: { ...typography.bold, fontSize: 13, color: P.ink, padding: 12, backgroundColor: P.cardBg, borderRadius: 10, borderWidth: 1, borderColor: P.border, marginBottom: 8, lineHeight: 19 },
  qopt: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 11, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff', marginBottom: 7 },
  qoptSel: { borderColor: P.cyan, backgroundColor: P.cyanBg },
  qoptOk: { borderColor: P.green, backgroundColor: P.greenBg },
  qoptWrong: { borderColor: P.red, backgroundColor: P.redBg },
  qLetter: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: P.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  qLetterSel: { backgroundColor: P.cyan, borderColor: P.cyan },
  qLetterOk: { backgroundColor: P.green, borderColor: P.green },
  qLetterWrong: { backgroundColor: P.red, borderColor: P.red },
  qLetterText: { fontSize: 11, fontWeight: '700', color: P.muted },
  qoptText: { flex: 1, fontSize: 12, color: P.body, lineHeight: 17 },

  tfSet: { marginBottom: 16 },
  tfQ: { fontSize: 13, fontWeight: '700', color: P.ink, padding: 12, backgroundColor: P.cardBg, borderRadius: 10, borderWidth: 1, borderColor: P.border, marginBottom: 10, lineHeight: 19 },
  tfOpts: { flexDirection: 'row', gap: 8 },
  tfBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: P.border, backgroundColor: '#fff', alignItems: 'center' },
  tfBtnTrue: { borderColor: P.green, backgroundColor: P.greenSoft },
  tfBtnFalse: { borderColor: P.red, backgroundColor: P.redBg },
  tfBtnCorrect: { borderColor: P.green, backgroundColor: P.greenBg },
  tfBtnWrong: { borderColor: P.red, backgroundColor: P.redBg },
  tfBtnText: { fontSize: 13, fontWeight: '700', color: P.body },

  ethicsCard: { backgroundColor: P.cardBg, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: P.border },
  ethicsText: { fontSize: 13, color: P.body, lineHeight: 18, marginBottom: 8 },
  ethicsOpts: { flexDirection: 'row', gap: 5 },
  ethicsOpt: { flex: 1, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 8, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff', alignItems: 'center' },
  ethicsOptSel: { borderColor: P.cyan, backgroundColor: P.cyanBg },
  ethicsOptOk: { borderColor: P.green, backgroundColor: P.greenBg },
  ethicsOptWrong: { borderColor: P.red, backgroundColor: P.redBg },
  ethicsOptText: { fontSize: 11, fontWeight: '600', color: P.body, textAlign: 'center' },

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

  reflectArea: { minHeight: 120, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fafafa', fontSize: 13, color: P.body, lineHeight: 22, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: P.faint, textAlign: 'right', marginTop: 4 },

  exCard: { borderRadius: 14, padding: 12, borderWidth: 1, borderColor: P.border, marginBottom: 8, backgroundColor: '#fff' },
  exCardOpen: { borderColor: P.cyan, backgroundColor: P.cyanBg },
  exHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exEmoji: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  exName: { fontSize: 13, fontWeight: '700', color: P.ink },
  exSub: { fontSize: 11, color: P.muted, marginTop: 1 },
  exArrow: { fontSize: 18, color: P.faint },
  exBody: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: P.border },
  exHow: { fontSize: 12, color: P.body, lineHeight: 19, marginBottom: 8 },
  exFact: { backgroundColor: '#fef9c3', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#fde68a' },
  exFactText: { fontSize: 12, color: '#854d0e', fontWeight: '500', lineHeight: 17 },

  fb: { borderRadius: 10, padding: 11, marginTop: 8 },
  fbOk: { backgroundColor: P.greenBg },
  fbBad: { backgroundColor: P.redBg },
  fbOkText: { fontSize: 12, color: P.greenText, lineHeight: 18, fontWeight: '500' },
  fbBadText: { fontSize: 12, color: P.redText, lineHeight: 18, fontWeight: '500' },

  completeContainer: { alignItems: 'center', paddingTop: 8 },
  completeBadge: { width: 88, height: 88, borderRadius: 24, backgroundColor: P.cyan, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
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
  lvlBarInner: { height: '100%', backgroundColor: P.cyan, borderRadius: 4 },

  navRow: { flexDirection: 'row', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fafafa' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  primaryBtn: { backgroundColor: P.green, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  primaryBtnAccent: { backgroundColor: P.cyan },
  primaryBtnOff: { opacity: 0.35 },
  primaryBtnText: { ...typography.bold, color: '#fff', fontSize: 15 },
});
