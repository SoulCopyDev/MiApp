import { router } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../../store/gameStore';
import { colors, typography } from '../../theme';

// ---------- Tipos ----------
type DragItem = { text: string; correct: string };
type MatchPairItem = { left: string; right: string };
type QuizItem = { q: string; opts: string[]; correct: number; explain: string };
type TFItem = { stmt: string; correct: boolean; explain: string };
type FillItem = { sentence: string; allOpts: string[]; correct: Record<string, number>; explain: string };
type ScenarioChoice = { title: string; text: string; correct: boolean; explain: string };
type EthicsItem = { text: string; correct: string; explain: string };
type SprintItem = { text: string; good: boolean };
type ConnectQuestion = { label: string; opts: { t: string; ok: boolean }[] };
type BuilderDayRow = { key: string; label: string; opts: string[] };
type FlowOpts = { trigger_opts: string[]; middle_opts: string[]; final_opts: string[] };

const TOTAL_STEPS = 21; // 0:intro + 19 módulos + 1:complete
const CONTENT_STEPS = 19;

const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

// ===================== POOLS =====================

const DOER_POOL: DragItem[] = [
  { text: 'Enviar 50 emails idénticos de bienvenida a nuevos usuarios', correct: 'bot' },
  { text: 'Publicar un tweet cuando sale un video nuevo en YouTube', correct: 'bot' },
  { text: 'Guardar en Drive los archivos que llegan por WhatsApp del trabajo', correct: 'bot' },
  { text: 'Mandar recordatorio cada lunes a las 9am al grupo del colegio', correct: 'bot' },
  { text: 'Crear evento en Google Calendar cuando llega email con "reunión"', correct: 'bot' },
  { text: 'Descargar cada viernes la lista de ventas del Excel corporativo', correct: 'bot' },
  { text: 'Transcribir reuniones grabadas de Zoom a texto', correct: 'bot' },
  { text: 'Decidir si contratar o despedir a un empleado', correct: 'pers' },
  { text: 'Consolar a un amigo que acaba de perder a un familiar', correct: 'pers' },
  { text: 'Dictar la sentencia final en un juicio penal', correct: 'pers' },
  { text: 'Negociar una alianza diplomática entre dos países', correct: 'pers' },
  { text: 'Elegir con quién vas a casarte', correct: 'pers' },
];

const QUIZ_Q_POOL: QuizItem[] = [
  { q: '¿Qué significa "disparador" (trigger) en una automatización?', opts: ['El error que detiene el flujo', 'El evento que inicia la automatización', 'Botón rojo para borrar todo', 'La acción final'], correct: 1, explain: 'Trigger = "cuando X sucede...". Ej: llega email, formulario completado, son las 9am.' },
  { q: 'Flujo: "email con factura → guarda en Drive → agrega fila a Sheets". ¿Cuál es la ACCIÓN final?', opts: ['Que llegue el email', 'Que tenga "factura" en asunto', 'Agregar fila a Sheets', 'El PDF adjunto'], correct: 2, explain: 'Última acción = resultado con valor. Email = trigger; Drive = intermedio; Sheets = cierre.' },
  { q: 'Diferencia clave entre Zapier y Make:', opts: ['Zapier gratis, Make pago', 'Make visual con diagramas; Zapier lineal paso a paso', 'Zapier solo en inglés', 'Make no conecta Gmail'], correct: 1, explain: 'Make = diagrama visual. Zapier = lineal. Ambos miles de apps.' },
  { q: '¿Qué NO deberías automatizar — nunca?', opts: ['Publicar post cuando subes video', 'Responder emocionalmente a un amigo en crisis', 'Generar reportes mensuales', 'Agendar reuniones'], correct: 1, explain: 'Decisiones con carga emocional o moral requieren presencia humana real.' },
  { q: 'Usas IA para responder emails de clientes cuando no estás. ¿Riesgo ético?', opts: ['IA responde más rápido', 'Clientes creen que hablan contigo (engaño)', 'IA escribe sin faltas', 'Demasiados emojis'], correct: 1, explain: 'Engaño. Solución: transparencia ("respuesta asistida por IA") o IA solo como borrador.' },
  { q: '"Cuando llegue PDF → resumir con IA → guardar en Notion". ¿Qué orquesta esto?', opts: ['Photoshop', 'Word', 'Zapier/Make/n8n', 'Solo Gmail'], correct: 2, explain: 'Zapier/Make/n8n = orquestadores. Gmail es solo trigger.' },
  { q: 'Automatizas TikTok → Instagram, pero copia hashtags de TikTok. ¿Qué pasó?', opts: ['Imposible automatizar eso', 'No se adaptó al contexto — faltó capa inteligente', 'IG te baneó', 'Hashtags iguales'], correct: 1, explain: 'Cada plataforma tiene su lenguaje. Buena automatización ADAPTA con IA, no solo copia.' },
  { q: '¿Qué es un "webhook"?', opts: ['Un error de servidor', 'Señal que una app envía cuando pasa algo — dispara flujos', 'Antivirus', 'Base de datos'], correct: 1, explain: 'Webhook = app A avisa "pasó X", lanza flujo en otra herramienta. Espina dorsal.' },
];

const TF_Q_POOL: TFItem[] = [
  { stmt: 'Automatizar responder a clientes sin revisar puede dañar tu reputación si la IA se equivoca', correct: true, explain: 'Una respuesta automática en mal momento (cliente enojado) escala todo.' },
  { stmt: 'Si una automatización funciona hoy, NUNCA fallará', correct: false, explain: 'Una API cambia, un email se pierde, un límite se alcanza. Monitorear siempre.' },
  { stmt: 'Automatizar demasiado puede hacerte perder el pulso de tu propio proyecto', correct: true, explain: 'Si nunca ves los datos en vivo, no notas tendencias. Automatiza rutina, mantente presente en lo estratégico.' },
  { stmt: 'Las automatizaciones con IA son siempre gratis', correct: false, explain: 'Zapier, Make y OpenAI tienen límites gratuitos. A escala, cuesta.' },
  { stmt: 'Publicar lo mismo en Twitter, LinkedIn e Instagram sin adaptar es mala práctica', correct: true, explain: 'Cada plataforma tiene su lenguaje. Adapta con IA; no solo copies.' },
  { stmt: 'Los webhooks son señales que una app envía cuando pasa algo — y son clave para automatizar', correct: true, explain: 'El disparador técnico detrás de muchos flujos modernos.' },
  { stmt: 'Automatizar contratación con IA está libre de riesgos éticos', correct: false, explain: 'Ha causado sesgos raciales y de género documentados. Requiere supervisión.' },
  { stmt: '"n8n" puede correr en tu propio servidor, dando más control sobre tus datos', correct: true, explain: 'Autohosting: tus datos no pasan por terceros. Ideal para privacidad estricta.' },
];

const ETHICS_POOL: EthicsItem[] = [
  { text: 'Automatizar enviar WhatsApp a familiares cuando llegas a casa', correct: 'ok', explain: 'ACEPTABLE. Útil, sin engaño, con consentimiento implícito.' },
  { text: 'Automatizar respuestas "como si fueras tú" a mensajes románticos de tu pareja', correct: 'no', explain: 'INACEPTABLE. Engaño directo en relación íntima. Destruye confianza.' },
  { text: 'Automatizar selección de CVs descartando candidatos sin revisar', correct: 'cuest', explain: 'CUESTIONABLE. Sesgos documentados. Requiere auditoría y supervisión humana.' },
  { text: 'Automatizar publicar nuevos videos de YouTube en Twitter', correct: 'ok', explain: 'ACEPTABLE. Contenido propio, sin engaño, ahorra tiempo.' },
  { text: 'Automatizar "felicidades cumpleaños" a todos tus contactos sin editar', correct: 'cuest', explain: 'CUESTIONABLE. Frío. Mejor: IA que personaliza cada mensaje.' },
  { text: 'Automatizar decisiones judiciales con IA sin juez humano', correct: 'no', explain: 'INACEPTABLE. Justicia requiere contexto, juicio moral, responsabilidad humana.' },
  { text: 'Automatizar envío de tarea escolar cuando se vence la fecha', correct: 'ok', explain: 'ACEPTABLE. Te protege del olvido. Decisión tuya, ejecución del sistema.' },
  { text: 'Automatizar calificar exámenes complejos de literatura sin revisión', correct: 'no', explain: 'INACEPTABLE para evaluación humana compleja. IA como asistente de calificación, no juez.' },
];

const SPRINT_POOL: SprintItem[] = [
  { text: 'Cuando llega email con "factura" → guardar PDF en Drive', good: true },
  { text: 'Cuando publico video en TikTok → subir automáticamente a YouTube', good: true },
  { text: 'Automatizar decir "te amo" a tu pareja cada noche sin escribirlo', good: false },
  { text: 'Cuando son las 9am lunes → IA envía resumen de agenda por WhatsApp', good: true },
  { text: 'Automatizar responder "como si fueras tú" a mensajes importantes sin leer', good: false },
  { text: 'Cuando se agrega producto a Shopify → IA genera descripción y postea en IG', good: true },
  { text: 'Automatizar calificar exámenes de literatura con IA sin revisión', good: false },
  { text: 'Cuando me mencionan en Twitter → notificación prioritaria en Slack', good: true },
  { text: 'Automatizar contratar personal solo con filtro de IA sin entrevistas', good: false },
  { text: 'Cuando recibo mensaje de mi jefe → enviar plantilla genérica sin leer', good: false },
];

const REPLACED_Q_POOL: QuizItem[] = [
  { q: '¿Qué área de atención al cliente automatiza IA hoy casi por completo?', opts: ['Contratos legales complejos', 'Respuestas a FAQ y soporte nivel 1', 'Negociación de precios', 'Resolución de disputas'], correct: 1, explain: 'FAQ y soporte nivel 1 ya es 70%+ IA.' },
  { q: 'En operaciones de comercio electrónico, ¿qué tarea ya se automatiza por defecto?', opts: ['Decidir qué productos lanzar', 'Actualización de inventario + notificación a clientes', 'Negociar con proveedores', 'Diseñar campañas'], correct: 1, explain: 'Inventario + notificaciones: 100% automatización estándar hoy.' },
  { q: 'En marketing digital, ¿qué tarea repetitiva ya se automatiza con IA?', opts: ['Definir estrategia anual', 'Generar variaciones de anuncios + A/B testing', 'Elegir tono de marca', 'Comprar empresas'], correct: 1, explain: 'Google Ads y Meta Ads automatizan generación de variantes + optimización.' },
  { q: 'En gestión de contenido: ¿qué tarea ya se automatiza?', opts: ['Elegir qué escribir', 'Programar publicación en múltiples canales', 'Definir identidad de marca', 'Crear contenido original'], correct: 1, explain: 'Programación multiplataforma = automatización estándar.' },
  { q: 'En finanzas personales: ¿qué área automatizan hoy apps como Nequi?', opts: ['Decidir cómo invertir', 'Categorizar gastos + alertas por patrones inusuales', 'Elegir pareja sentimental', 'Negociar ascensos'], correct: 1, explain: 'Categorización + alertas: 100% IA. Decisiones financieras siguen siendo del usuario.' },
];

const AUTO_FINAL_Q_POOL: QuizItem[] = [
  { q: 'Tu empresa exige que los datos NO salgan del servidor corporativo. ¿Qué orquestador usas?', opts: ['Zapier (cloud)', 'Make (cloud)', 'n8n autohosteado', 'IFTTT'], correct: 2, explain: 'n8n autohosteado = datos en tu servidor. Única opción compatible.' },
  { q: '¿Qué es un "multi-step zap" en Zapier?', opts: ['Flujo con 2+ acciones después del trigger', 'Error de autenticación', 'Plan premium', 'Bot de Telegram'], correct: 0, explain: 'Multi-step = más allá de trigger + 1 acción. Requiere plan pago.' },
  { q: 'Al diseñar un flujo, ¿por qué empiezas por el TRIGGER y no por la acción final?', opts: ['Es más fácil', 'El trigger define qué datos estarán disponibles aguas abajo', 'Es más barato', 'Aleatorio'], correct: 1, explain: 'El trigger determina qué información fluye.' },
  { q: '¿Qué hace un "filter" en un flujo de Zapier?', opts: ['Borra datos', 'Detiene el flujo si no cumple condición', 'Añade ruido', 'Backup'], correct: 1, explain: 'Filter = compuerta. Ahorra acciones innecesarias.' },
  { q: 'Diseñas: "cuando llega email → IA resume → envía por WhatsApp". ¿Qué API paga estás usando?', opts: ['Solo Zapier', 'OpenAI (o Claude) para el resumen', 'Ninguna', 'Windows'], correct: 1, explain: 'El paso "resumir con IA" llama a OpenAI/Claude/Gemini.' },
  { q: '"If cliente_VIP == true, notifica por SMS; else archiva". ¿Qué herramienta es ideal?', opts: ['Zapier (lineal)', 'Make (tiene router visual)', 'WhatsApp', 'Excel'], correct: 1, explain: 'Make tiene routers visuales para bifurcaciones.' },
];

const RESP_SCN: ScenarioChoice[] = [
  { title: 'Mi pareja me escribe "te extraño" y la IA responde por mí', text: 'Un bot lee el mensaje, detecta emoción y responde sin que yo lo sepa.', correct: false, explain: 'Inaceptable. Las relaciones íntimas exigen respuesta humana real.' },
  { title: 'Un cliente envía "cuál es el precio" y la IA responde con tabla oficial', text: 'La IA responde datos transaccionales objetivos mientras estoy en reunión.', correct: true, explain: 'Aceptable. Información factual repetitiva se delega sin conflicto ético.' },
  { title: 'Un amigo me escribe "mi papá acaba de morir" y la IA responde con pésame automático', text: 'Respuesta de condolencia genérica enviada sin que yo lo lea.', correct: false, explain: 'Crueldad involuntaria. Momentos así exigen presencia humana real.' },
  { title: 'Un vendedor pregunta "horario de atención" y la IA responde con info del sitio', text: 'Consulta impersonal, respuesta factual disponible públicamente.', correct: true, explain: 'Aceptable. Sin carga emocional, info pública — ideal para automatizar.' },
];

const FILL_POOL: FillItem[] = [
  { sentence: 'El evento que inicia una automatización se llama _____.', allOpts: ['disparador', 'ejecutor', 'cierre', 'interfaz'], correct: { fb0: 0 }, explain: 'Disparador (trigger): evento que arranca el flujo.' },
  { sentence: 'Zapier, Make y n8n son herramientas de _____ que conectan apps.', allOpts: ['automatización', 'traducción', 'edición', 'seguridad'], correct: { fb0: 0 }, explain: 'Orquestadores de automatización.' },
  { sentence: 'Las señales técnicas que una app envía cuando pasa algo se llaman _____.', allOpts: ['webhooks', 'cookies', 'pixeles', 'puertos'], correct: { fb0: 0 }, explain: 'Webhook: "app A dice pasó X", lanza flujo.' },
  { sentence: 'La ventaja principal de n8n es que puedes _____ en tu servidor.', allOpts: ['autohostearlo', 'descargarlo', 'editarlo', 'cancelarlo'], correct: { fb0: 0 }, explain: 'Autohosting: privacidad, control, costo plano.' },
];

const SORT_FLOW = [
  'Identifica el problema: ¿qué tarea repetitiva te quita tiempo?',
  'Define el disparador: ¿qué evento debería iniciar el flujo?',
  'Diseña pasos intermedios: ¿qué hace el sistema entre trigger y resultado?',
  'Conecta las apps: en Zapier/Make/n8n, une los nodos',
  'Prueba con datos reales: ejecuta y verifica el output',
  'Monitorea en producción: revisa que siga funcionando y ajusta',
];

const CONNECT_APPS = {
  scenario: 'Quieres que cuando llegue email con "informe", una IA lo resuma y guarde el resumen en Notion etiquetado con la fecha.',
  questions: [
    { label: '1. ¿Cuál es el DISPARADOR correcto?', opts: [{ t: 'Cada vez que envío email', ok: false }, { t: 'Cuando llega email a Gmail con "informe" en el asunto', ok: true }, { t: 'Cuando creo página en Notion', ok: false }] },
    { label: '2. ¿Cuál es el PASO INTERMEDIO correcto?', opts: [{ t: 'La IA traduce al francés', ok: false }, { t: 'Se envía emoji al remitente', ok: false }, { t: 'La IA (OpenAI/Claude) resume el email en 5 puntos', ok: true }] },
    { label: '3. ¿Cuál es la ACCIÓN FINAL correcta?', opts: [{ t: 'Imprimir el resumen', ok: false }, { t: 'Crear página en Notion con resumen y fecha', ok: true }, { t: 'Borrar el email original', ok: false }] },
  ],
};

const BUILDER_DAY = {
  xp: 20,
  rows: [
    { key: 'manana', label: '☀️ Mañana (despertar → llegar a estudiar)', opts: ['IA envía resumen de noticias + tu agenda por WhatsApp a las 7am', 'IA traduce tareas del día a checklist priorizado', 'Bot de calendario reagenda reuniones bajas si estás cansado'] },
    { key: 'tarde', label: '🌤️ Tarde (estudio/trabajo)', opts: ['IA convierte PDFs de clase en resúmenes automáticos', 'Flujo: Gmail → Notion con archivos clasificados por tema', 'IA clasifica tus emails entrantes por urgencia'] },
    { key: 'noche', label: '🌙 Noche (cierre del día)', opts: ['IA genera resumen de lo logrado + plan de mañana', 'Bot revisa pendientes y envía recordatorios', 'Backup automático de tus creaciones a Drive'] },
  ],
};

const FLOW_CFG: FlowOpts = {
  trigger_opts: ['Llega email con "tarea" en el asunto', 'Se graba reunión en Zoom', 'Recibo factura PDF por WhatsApp', 'Son las 7am de un lunes'],
  middle_opts: ['La IA resume el contenido en 5 puntos clave', 'La IA lo traduce al inglés', 'La IA clasifica por prioridad (alta/media/baja)', 'La IA extrae nombres y fechas mencionadas'],
  final_opts: ['Guarda el resultado en Notion', 'Envía el resultado por WhatsApp', 'Crea una fila en Google Sheets', 'Agenda un evento en Google Calendar'],
};

// ===================== COMPONENTE =====================
interface LevelProps {
  navigation?: any;
  setAllowBack?: (allow: boolean) => void;
}

export default function World5Level2({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore((s) => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Pools aleatorios
  const [doerItems] = useState(() => pickN(DOER_POOL, 8));
  const [quizQItems] = useState(() => pickN(QUIZ_Q_POOL, 4));
  const [tfItems] = useState(() => pickN(TF_Q_POOL, 5));
  const [ethicsItems] = useState(() => pickN(ETHICS_POOL, 5));
  const [replacedQItems] = useState(() => pickN(REPLACED_Q_POOL, 4));
  const [autoFinalQItems] = useState(() => pickN(AUTO_FINAL_Q_POOL, 6));
  const [fillItem] = useState(() => pickN(FILL_POOL, 1)[0]);
  const [sprintItems] = useState(() => pickN(SPRINT_POOL, 10));

  // Estados de módulos
  const [dragPlaced, setDragPlaced] = useState<Record<number, string>>({});
  const [dragSel, setDragSel] = useState<number | null>(null);
  const [dragAttempts, setDragAttempts] = useState(0);
  const [dragOk, setDragOk] = useState(false);

  const [matchLeft, setMatchLeft] = useState<number | null>(null);
  const [matchDone, setMatchDone] = useState(0);
  const [rightOrder] = useState<string[]>([]);

  const [sortOrder, setSortOrder] = useState<number[]>([]);
  const [sortOk, setSortOk] = useState(false);

  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizChecked, setQuizChecked] = useState(false);

  const [tfAnswers, setTfAnswers] = useState<Record<number, boolean>>({});
  const [tfChecked, setTfChecked] = useState(false);

  const [fillSel, setFillSel] = useState<number | null>(null);
  const [fillChecked, setFillChecked] = useState(false);

  const [scenarioSel, setScenarioSel] = useState<number | null>(null);
  const [scenarioDone, setScenarioDone] = useState(false);

  const [ethicsAnswers, setEthicsAnswers] = useState<Record<number, string>>({});
  const [ethicsDone, setEthicsDone] = useState(false);

  const [sprintPicks, setSprintPicks] = useState<Record<number, string>>({});
  const [sprintSec, setSprintSec] = useState(90);
  const [sprintStarted, setSprintStarted] = useState(false);
  const [sprintDone, setSprintDone] = useState(false);
  const sprintTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [flowState, setFlowState] = useState({ trigger: '', middle: '', final: '' });

  const [connectAnswers, setConnectAnswers] = useState<Record<number, number>>({});
  const [connectDone, setConnectDone] = useState(false);

  const [builderDay, setBuilderDay] = useState<Record<string, string>>({});

  const [reflectVal, setReflectVal] = useState('');
  const [reflectMinLen, setReflectMinLen] = useState(80);

  const examSteps = new Set([3, 7, 8, 9, 10, 11, 12, 14, 15, 17, 19]);
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
    if (step === 3) { setDragPlaced({}); setDragSel(null); setDragAttempts(0); setDragOk(false); }
    if (step === 7) { const o = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5); setSortOrder(o); setSortOk(false); }
    if (step === 8) { setQuizAnswers({}); setQuizChecked(false); }
    if (step === 9) { setScenarioSel(null); setScenarioDone(false); }
    if (step === 10) { setTfAnswers({}); setTfChecked(false); }
    if (step === 11) { setEthicsAnswers({}); setEthicsDone(false); }
    if (step === 12) { setSprintPicks({}); setSprintSec(90); setSprintStarted(false); setSprintDone(false); if (sprintTimer.current) clearInterval(sprintTimer.current); }
    if (step === 14) { setConnectAnswers({}); setConnectDone(false); }
    if (step === 15) { setQuizAnswers({}); setQuizChecked(false); }
    if (step === 17) { setBuilderDay({}); }
    if (step === 19) { setQuizAnswers({}); setQuizChecked(false); }
  }, [step]);

  const addXP = (n: number) => setXp((p) => p + n);
  const goNext = () => { if (step < TOTAL_STEPS - 1) setStep(step + 1); };
  const handleClose = () => Alert.alert('Salir', '¿Seguro?', [{ text: 'Cancelar' }, { text: 'Salir', onPress: () => router.back() }]);
  const handleFinish = () => {
    let stars = 0;
    if (xp >= 180) stars = 3; else if (xp >= 120) stars = 2; else if (xp >= 60) stars = 1;
    completeLevel(5, 2, stars, xp);
    router.back();
  };

  // Drag
  const dropDrag = (idx: number, col: string) => { setDragPlaced((p) => ({ ...p, [idx]: col })); setDragSel(null); };
  const retDrag = (idx: number) => { setDragPlaced((p) => { const n = { ...p }; delete n[idx]; return n; }); };
  const checkDrag = () => {
    if (dragOk) return true;
    if (Object.keys(dragPlaced).length < doerItems.length) { Alert.alert('Faltan', 'Clasifica todas.'); return false; }
    setDragAttempts((p) => p + 1);
    let correct = 0; const wrong: number[] = [];
    Object.entries(dragPlaced).forEach(([k, v]) => { const i = parseInt(k); if (v === doerItems[i].correct) correct++; else wrong.push(i); });
    if (correct === doerItems.length) {
      setDragOk(true); addXP(dragAttempts === 0 ? 20 : 10);
      Alert.alert('¡Genial!', `+${dragAttempts === 0 ? 20 : 10} XP`, [{ text: 'OK', onPress: goNext }]); return false;
    }
    Alert.alert('Revisa', `${correct}/${doerItems.length} correctas.`);
    const np = { ...dragPlaced }; wrong.forEach((i) => delete np[i]); setDragPlaced(np);
    return false;
  };

  // Sort
  const moveSort = (pos: number, dir: number) => {
    const np = pos + dir; if (np < 0 || np >= sortOrder.length) return;
    const no = [...sortOrder]; [no[pos], no[np]] = [no[np], no[pos]]; setSortOrder(no);
  };
  const checkSort = () => {
    if (sortOk) return true;
    if (sortOrder.every((v, i) => v === i)) { setSortOk(true); addXP(15); Alert.alert('¡Perfecto!', '+15 XP', [{ text: 'OK', onPress: goNext }]); return false; }
    Alert.alert('Incorrecto', 'Algunos pasos fuera de lugar.'); return false;
  };

  // Quiz genérico
  const selQuiz = (qi: number, oi: number, setter: (p: Record<number, number>) => void, items: QuizItem[]) => {
    setQuizAnswers((prev) => ({ ...prev, [qi]: oi }));
    setter({ ...quizAnswers, [qi]: oi });
  };
  const checkQuizGen = (items: QuizItem[], checked: boolean, setChecked: (v: boolean) => void, answers: Record<number, number>) => {
    if (checked) return true;
    if (Object.keys(answers).length < items.length) { Alert.alert('Incompleto'); return false; }
    setChecked(true);
    let c = 0;
    items.forEach((q, i) => { if (answers[i] === q.correct) c++; });
    addXP(c * 8);
    Alert.alert(`${c}/${items.length} correctas`, `+${c * 8} XP`, [{ text: 'OK', onPress: goNext }]);
    return false;
  };

  // TF
  const selTF = (qi: number, v: boolean) => { if (!tfChecked) setTfAnswers((p) => ({ ...p, [qi]: v })); };
  const checkTF = () => {
    if (tfChecked) return true;
    if (Object.keys(tfAnswers).length < tfItems.length) { Alert.alert('Incompleto'); return false; }
    setTfChecked(true);
    let c = 0;
    tfItems.forEach((q, i) => { if (tfAnswers[i] === q.correct) c++; });
    addXP(c * 5);
    Alert.alert(`${c}/${tfItems.length} correctas`, `+${c * 5} XP`, [{ text: 'OK', onPress: goNext }]);
    return false;
  };

  // Fill
  const selFill = (i: number) => { if (!fillChecked) setFillSel(i); };
  const checkFill = () => {
    if (fillChecked) return true;
    if (fillSel === null) { Alert.alert('Elige una opción'); return false; }
    setFillChecked(true);
    const isOk = fillSel === fillItem.correct.fb0;
    if (isOk) addXP(10);
    Alert.alert(isOk ? '✅ ¡Correcto! +10 XP' : '❌ Incorrecto', fillItem.explain);
    return false;
  };

  // Scenario
  const selScenario = (i: number) => { if (!scenarioDone) setScenarioSel(i); };
  const checkScenario = () => {
    if (scenarioDone) return true;
    if (scenarioSel === null) { Alert.alert('Elige una opción'); return false; }
    setScenarioDone(true);
    const correctIdx = RESP_SCN.findIndex((c) => c.correct);
    if (scenarioSel === correctIdx) addXP(12);
    Alert.alert(scenarioSel === correctIdx ? '✅ ¡Correcto! +12 XP' : '❌ Incorrecto', RESP_SCN[correctIdx].explain);
    return false;
  };

  // Ethics
  const pickEthics = (i: number, col: string) => { if (!ethicsDone) setEthicsAnswers((p) => ({ ...p, [i]: col })); };
  const checkEthics = () => {
    if (ethicsDone) return true;
    if (Object.keys(ethicsAnswers).length < ethicsItems.length) { Alert.alert('Clasifica todos'); return false; }
    setEthicsDone(true);
    let c = 0;
    ethicsItems.forEach((item, i) => { if (ethicsAnswers[i] === item.correct) c++; });
    addXP(c * 5);
    Alert.alert(`${c}/${ethicsItems.length} correctas`, `+${c * 5} XP`, [{ text: 'OK', onPress: goNext }]);
    return false;
  };

  // Sprint
  const startSprint = () => {
    setSprintStarted(true);
    setSprintSec(90);
    sprintTimer.current = setInterval(() => {
      setSprintSec((prev) => { if (prev <= 1) { clearInterval(sprintTimer.current!); endSprint(); return 0; } return prev - 1; });
    }, 1000);
  };
  const pickSprint = (i: number) => {
    if (sprintDone || sprintPicks[i] !== undefined) return;
    const item = sprintItems[i];
    setSprintPicks((p) => ({ ...p, [i]: item.good ? 'good' : 'bad' }));
    const newPicks = { ...sprintPicks, [i]: item.good ? 'good' : 'bad' };
    const good = Object.values(newPicks).filter((v) => v === 'good').length;
    const totalGood = sprintItems.filter((x) => x.good).length;
    if (good >= 5 || good === totalGood) endSprint();
  };
  const endSprint = () => {
    if (sprintDone) return;
    setSprintDone(true);
    if (sprintTimer.current) clearInterval(sprintTimer.current);
    const good = Object.values(sprintPicks).filter((v) => v === 'good').length;
    const bad = Object.values(sprintPicks).filter((v) => v === 'bad').length;
    const earned = Math.max(0, good * 5 - bad * 2);
    if (earned > 0) addXP(earned);
    Alert.alert(good >= 5 ? '¡Sprint logrado!' : 'No alcanzaste la meta', `${good} buenas, ${bad} malas. +${earned} XP`);
  };

  // Connect
  const pickConnect = (qi: number, oi: number) => { if (!connectDone) setConnectAnswers((p) => ({ ...p, [qi]: oi })); };
  const checkConnect = () => {
    if (connectDone) return true;
    if (Object.keys(connectAnswers).length < CONNECT_APPS.questions.length) { Alert.alert('Completa todos los pasos'); return false; }
    setConnectDone(true);
    let c = 0;
    CONNECT_APPS.questions.forEach((q, qi) => {
      const okIdx = q.opts.findIndex((o) => o.ok);
      if (connectAnswers[qi] === okIdx) c++;
    });
    addXP(c * 8);
    Alert.alert(`${c}/${CONNECT_APPS.questions.length} correctas`, `+${c * 8} XP`, [{ text: 'OK', onPress: goNext }]);
    return false;
  };

  // Builder day
  const selectBuilderDay = (key: string, val: string) => { setBuilderDay((p) => ({ ...p, [key]: val })); };
  const checkBuilderDay = () => {
    if (Object.keys(builderDay).length < BUILDER_DAY.rows.length) { Alert.alert('Completa todas las filas'); return false; }
    addXP(BUILDER_DAY.xp);
    return true;
  };

  // Flow builder
  const pickFlow = (key: string, val: string) => { setFlowState((p) => ({ ...p, [key]: val })); };
  const checkFlow = () => {
    if (!flowState.trigger || !flowState.middle || !flowState.final) { Alert.alert('Completa los 3 nodos'); return false; }
    addXP(22);
    return true;
  };

  // Reflexión
  const checkReflect = (minLen: number) => {
    if (reflectVal.trim().length >= minLen) { addXP(minLen >= 100 ? 15 : 12); return true; }
    Alert.alert('Muy corto', `Escribe al menos ${minLen} caracteres.`);
    return false;
  };

  // ============ RENDER ============
  const renderIntro = () => (
    <View>
      <View style={styles.iconCircle}><Text style={{ fontSize: 34 }}>⚡</Text></View>
      <Text style={styles.title}>Haz que la IA Trabaje Sola</Text>
      <Text style={styles.subtitle}>Aprende a delegar lo repetitivo. Al terminar vas a ver oportunidades de automatización por todas partes.</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>📚 Qué vas a aprender</Text><Text style={styles.cardText}>Qué es automatizar · Zapier, Make, n8n · La fórmula trigger→acción · Ética · Flujos con IA</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>⚡ Qué podrás HACER</Text><Text style={styles.cardText}>Diseñar flujos completos de automatización con disparador + IA + acción final.</Text></View>
    </View>
  );

  const renderTheory1 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ecfeff' }]}><Text style={[styles.tagText, { color: '#155e75' }]}>📖 Módulo 1 · Teoría</Text></View>
      <Text style={styles.title}>¿Qué es automatizar?</Text>
      <Text style={styles.bodyText}>La <Text style={{ fontWeight: 'bold' }}>automatización</Text> es diseñar sistemas que ejecuten tareas por ti. Combinando IA + automatización puedes delegar el 80% de lo repetitivo.</Text>
      <View style={styles.highlight}><Text style={styles.highlightText}><Text style={{ fontWeight: 'bold' }}>💡 La fórmula mágica:</Text> CUANDO pase X → HAZ Y → RESULTADO Z.</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>🛠️ Las 3 herramientas</Text><Text style={styles.cardText}>Zapier: la más popular, simple. Make: editor visual con bifurcaciones. n8n: open source, autohosteable.</Text></View>
    </View>
  );

  const renderReflect = (title: string, question: string, placeholder: string, minLen: number) => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f3f4f6' }]}><Text style={[styles.tagText, { color: '#374151' }]}>✍️ Reflexión · +{minLen >= 100 ? 15 : 12} XP</Text></View>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.card, { backgroundColor: '#faf5ff' }]}>
        <Text style={styles.cardTitle}>🤔 Tu pregunta</Text>
        <Text style={styles.cardText}>{question}</Text>
      </View>
      <TextInput style={styles.textArea} multiline placeholder={placeholder} value={reflectVal} onChangeText={setReflectVal} />
      <Text style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>{reflectVal.length} / {minLen} mínimo</Text>
    </View>
  );

  const renderDrag = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#eff6ff' }]}><Text style={[styles.tagText, { color: '#1e40af' }]}>🧩 Módulo 3 · Clasificar</Text></View>
      <Text style={styles.title}>¿Lo hace persona o robot?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {doerItems.map((item, idx) => (
          dragPlaced[idx] === undefined && (
            <TouchableOpacity key={idx} style={[styles.chip, dragSel === idx && { borderColor: '#0891b2', backgroundColor: '#ecfeff' }]} onPress={() => setDragSel(dragSel === idx ? null : idx)}>
              <Text style={{ fontSize: 11 }}>{item.text}</Text>
            </TouchableOpacity>
          )
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['bot', 'pers'] as const).map((col) => (
          <TouchableOpacity key={col} style={[styles.dropCol, { flex: 1 }]} onPress={() => { if (dragSel !== null) dropDrag(dragSel, col); }}>
            <Text style={{ fontWeight: 'bold', fontSize: 11, color: col === 'bot' ? '#155e75' : '#9d174d' }}>{col === 'bot' ? '🤖 Robot' : '🧑 Persona'}</Text>
            {Object.entries(dragPlaced).filter(([, v]) => v === col).map(([k]) => (
              <TouchableOpacity key={k} style={{ backgroundColor: col === 'bot' ? '#cffafe' : '#fce7f3', padding: 4, borderRadius: 8, marginTop: 4 }} onPress={() => retDrag(parseInt(k))}>
                <Text style={{ fontSize: 10 }}>{doerItems[parseInt(k)].text} ✕</Text>
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderSort = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f5f3ff' }]}><Text style={[styles.tagText, { color: '#5b21b6' }]}>↕️ Módulo 7 · Ordenar</Text></View>
      <Text style={styles.title}>Los 6 pasos para diseñar un flujo</Text>
      {sortOrder.map((stepIdx, pos) => (
        <View key={pos} style={styles.sortItem}>
          <Text style={styles.sortNum}>{pos + 1}</Text>
          <Text style={styles.sortText}>{SORT_FLOW[stepIdx]}</Text>
          <View style={styles.sortArrows}>
            <TouchableOpacity style={styles.sortBtn} onPress={() => moveSort(pos, -1)} disabled={pos === 0}><MaterialIcons name="keyboard-arrow-up" size={18} /></TouchableOpacity>
            <TouchableOpacity style={styles.sortBtn} onPress={() => moveSort(pos, 1)} disabled={pos === sortOrder.length - 1}><MaterialIcons name="keyboard-arrow-down" size={18} /></TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  const renderQuiz = (items: QuizItem[], answers: Record<number, number>, checked: boolean, onAnswer: (qi: number, oi: number) => void, tag: string) => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>{tag}</Text></View>
      {items.map((q, qi) => (
        <View key={qi} style={{ marginBottom: 14 }}>
          <Text style={styles.quizQ}>{qi + 1}. {q.q}</Text>
          {q.opts.map((opt, oi) => (
            <TouchableOpacity key={oi} style={[styles.quizOpt, answers[qi] === oi && { borderColor: '#0891b2', backgroundColor: '#ecfeff' }]} onPress={() => onAnswer(qi, oi)} disabled={checked}>
              <Text style={styles.quizLetter}>{String.fromCharCode(65 + oi)}</Text>
              <Text style={{ flex: 1, fontSize: 12 }}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );

  const renderScenarioComp = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}><Text style={[styles.tagText, { color: '#7e22ce' }]}>🎯 Módulo 9 · Escenario</Text></View>
      <Text style={styles.title}>Si alguien me escribe → IA responde</Text>
      {RESP_SCN.map((c, i) => (
        <TouchableOpacity key={i} style={[styles.optionBtn, scenarioSel === i && { borderColor: '#0891b2', backgroundColor: '#ecfeff' }]} onPress={() => selScenario(i)} disabled={scenarioDone}>
          <Text style={{ fontWeight: 'bold', fontSize: 12 }}>{c.title}</Text>
          <Text style={{ fontSize: 11, color: '#6b7280' }}>{c.text}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderTF = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>✅ Módulo 10 · V/F</Text></View>
      <Text style={styles.title}>Errores de automatización</Text>
      {tfItems.map((item, idx) => (
        <View key={idx} style={{ marginBottom: 14 }}>
          <Text style={styles.tfQuestion}>{idx + 1}. {item.stmt}</Text>
          <View style={{ flexDirection: 'row', gap: 7 }}>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx] === true && { borderColor: '#16a34a', backgroundColor: '#f0fdf4' }]} onPress={() => selTF(idx, true)} disabled={tfChecked}><Text>✅ V</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx] === false && { borderColor: '#dc2626', backgroundColor: '#fef2f2' }]} onPress={() => selTF(idx, false)} disabled={tfChecked}><Text>❌ F</Text></TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  const renderEthics = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}><Text style={[styles.tagText, { color: '#7e22ce' }]}>⚖️ Módulo 11 · Clasificador ético</Text></View>
      <Text style={styles.title}>Automatización + Ética</Text>
      {ethicsItems.map((item, i) => (
        <View key={i} style={[styles.card, { marginBottom: 8 }]}>
          <Text style={{ fontWeight: '600', marginBottom: 6 }}>{i + 1}. {item.text}</Text>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {['ok', 'cuest', 'no'].map((col) => (
              <TouchableOpacity key={col} style={[styles.ethOpt, ethicsAnswers[i] === col && { borderColor: '#0891b2', backgroundColor: '#ecfeff' }]} onPress={() => pickEthics(i, col)} disabled={ethicsDone}>
                <Text style={{ fontSize: 11, fontWeight: '600' }}>{col === 'ok' ? '✅ Aceptable' : col === 'cuest' ? '⚠️ Cuestionable' : '❌ Inaceptable'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  const renderSprint = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fee2e2' }]}><Text style={[styles.tagText, { color: '#991b1b' }]}>⏱ Módulo 12 · Sprint</Text></View>
      <Text style={styles.title}>Sprint: ¿buena o mala automatización?</Text>
      <Text style={{ fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: sprintSec <= 10 ? '#dc2626' : '#c2410c', marginVertical: 8 }}>{Math.floor(sprintSec / 60)}:{String(sprintSec % 60).padStart(2, '0')}</Text>
      {!sprintStarted && !sprintDone && (
        <TouchableOpacity style={styles.nextBtn} onPress={startSprint}><Text style={styles.nextText}>⚡ Iniciar Sprint</Text></TouchableOpacity>
      )}
      {(sprintStarted || sprintDone) && sprintItems.map((item, i) => (
        <TouchableOpacity
          key={i}
          style={[styles.sprintItem, sprintPicks[i] === 'good' && { borderColor: '#16a34a', backgroundColor: '#dcfce7' }, sprintPicks[i] === 'bad' && { borderColor: '#dc2626', backgroundColor: '#fef2f2' }]}
          onPress={() => pickSprint(i)}
          disabled={sprintDone || sprintPicks[i] !== undefined}
        >
          <Text style={{ flex: 1, fontSize: 12 }}>{item.text}</Text>
          <Text style={{ fontWeight: 'bold', fontSize: 11 }}>{sprintPicks[i] === 'good' ? '✅' : sprintPicks[i] === 'bad' ? '❌' : ''}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderFlow = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ecfeff' }]}><Text style={[styles.tagText, { color: '#155e75' }]}>⚡ Módulo 6 · Flow Builder</Text></View>
      <Text style={styles.title}>La fórmula: cuando X → hace Y</Text>
      {[
        { key: 'trigger', label: '⚡ Disparador', val: flowState.trigger, opts: FLOW_CFG.trigger_opts },
        { key: 'middle', label: '🤖 Paso con IA', val: flowState.middle, opts: FLOW_CFG.middle_opts },
        { key: 'final', label: '📦 Acción final', val: flowState.final, opts: FLOW_CFG.final_opts },
      ].map((node) => (
        <View key={node.key} style={{ marginBottom: 10 }}>
          <Text style={{ fontWeight: 'bold', color: '#155e75', marginBottom: 4 }}>{node.label}: {node.val || 'elige una opción'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            {node.opts.map((opt) => (
              <TouchableOpacity key={opt} style={[styles.flowOpt, flowState[node.key as keyof typeof flowState] === opt && { borderColor: '#0891b2', backgroundColor: '#ecfeff' }]} onPress={() => pickFlow(node.key, opt)}>
                <Text style={{ fontSize: 11 }}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  const renderConnect = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ecfeff' }]}><Text style={[styles.tagText, { color: '#155e75' }]}>🔗 Módulo 14 · Conecta apps</Text></View>
      <Text style={styles.title}>Conecta Gmail + IA + Notion</Text>
      <View style={[styles.highlight, { backgroundColor: '#fffbeb', borderLeftColor: '#f59e0b' }]}>
        <Text style={{ color: '#92400e', fontSize: 12 }}>{CONNECT_APPS.scenario}</Text>
      </View>
      {CONNECT_APPS.questions.map((q, qi) => (
        <View key={qi} style={{ marginBottom: 10 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 12, marginBottom: 4 }}>{q.label}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            {q.opts.map((o, oi) => (
              <TouchableOpacity key={oi} style={[styles.flowOpt, connectAnswers[qi] === oi && { borderColor: '#0891b2', backgroundColor: '#ecfeff' }]} onPress={() => pickConnect(qi, oi)} disabled={connectDone}>
                <Text style={{ fontSize: 11 }}>{o.t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  const renderBuilderDay = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ecfeff' }]}><Text style={[styles.tagText, { color: '#155e75' }]}>🛠️ Módulo 17 · Builder</Text></View>
      <Text style={styles.title}>Diseña tu día automatizado</Text>
      {BUILDER_DAY.rows.map((row) => (
        <View key={row.key} style={{ marginBottom: 12 }}>
          <Text style={{ fontWeight: 'bold', color: '#155e75', marginBottom: 4 }}>{row.label}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            {row.opts.map((opt) => (
              <TouchableOpacity key={opt} style={[styles.flowOpt, builderDay[row.key] === opt && { borderColor: '#0891b2', backgroundColor: '#ecfeff' }]} onPress={() => selectBuilderDay(row.key, opt)}>
                <Text style={{ fontSize: 11 }}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  const renderCompletion = () => (
    <View style={{ alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 56 }}>⚡</Text>
      <Text style={[styles.title, { textAlign: 'center' }]}>¡Nivel 26 completado!</Text>
      <Text style={[styles.subtitle, { textAlign: 'center' }]}>Terminaste "Haz que la IA Trabaje Sola". Ahora eres Automation Engineer.</Text>
      <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#0891b2', marginVertical: 12 }}>⭐ {xp} XP</Text>
      <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Volver al mapa</Text></TouchableOpacity>
    </View>
  );

  // ============ RENDER PRINCIPAL ============
  const renderStep = () => {
    switch (step) {
      case 0: return renderIntro();
      case 1: return renderTheory1();
      case 2: return renderReflect('Piensa tú', '¿Qué 5 tareas haces manualmente que te gustaría que pasaran solas?', '1. Enviar el link de la clase...', 80);
      case 3: return renderDrag();
      case 4: return <View><Text style={styles.title}>Zapier · Conecta apps sin código</Text><View style={styles.card}><Text style={styles.cardText}>Conecta 5,000+ apps con lógica "cuando X → haz Y".</Text></View></View>;
      case 5: return <View><Text style={styles.title}>Make + agendas inteligentes</Text><View style={styles.card}><Text style={styles.cardText}>Editor visual con bifurcaciones. Cal.ai y Reclaim que piensan solos.</Text></View></View>;
      case 6: return renderFlow();
      case 7: return renderSort();
      case 8: return renderQuiz(quizQItems, quizAnswers, quizChecked, (qi, oi) => selQuiz(qi, oi, setQuizAnswers, quizQItems), '❓ Módulo 8 · Quiz');
      case 9: return renderScenarioComp();
      case 10: return renderTF();
      case 11: return renderEthics();
      case 12: return renderSprint();
      case 13: return <View><Text style={styles.title}>n8n · Open source</Text><View style={styles.card}><Text style={styles.cardText}>Control total, privacidad completa. Lo instalas en tu propio servidor.</Text></View></View>;
      case 14: return renderConnect();
      case 15: return renderQuiz(replacedQItems, quizAnswers, quizChecked, (qi, oi) => selQuiz(qi, oi, setQuizAnswers, replacedQItems), '❓ Módulo 15 · Quiz IA reemplaza');
      case 16: return renderReflect('Reflexión ética', '¿Cuáles serían TUS 3 reglas personales sobre qué automatizarás y qué jamás le delegarás?', 'Mis 3 reglas...', 80);
      case 17: return renderBuilderDay();
      case 18: return renderReflect('Reflexión creatividad', '¿Qué parte de tu proceso creativo automatizarías HOY mismo — y qué parte jamás?', 'Automatizaría...', 100);
      case 19: return renderQuiz(autoFinalQItems, quizAnswers, quizChecked, (qi, oi) => selQuiz(qi, oi, setQuizAnswers, autoFinalQItems), '❓ Módulo 19 · Quiz final');
      case 20: return renderCompletion();
      default: return null;
    }
  };

  const progress = (step / (TOTAL_STEPS - 1)) * 100;

  const handleMain = () => {
    const handlers: Record<number, (() => boolean) | undefined> = {
      2: () => checkReflect(80),
      3: checkDrag,
      6: checkFlow,
      7: checkSort,
      8: () => checkQuizGen(quizQItems, quizChecked, setQuizChecked, quizAnswers),
      9: checkScenario,
      10: checkTF,
      11: checkEthics,
      12: () => sprintDone,
      14: checkConnect,
      15: () => checkQuizGen(replacedQItems, quizChecked, setQuizChecked, quizAnswers),
      16: () => checkReflect(80),
      17: checkBuilderDay,
      18: () => checkReflect(100),
      19: () => checkQuizGen(autoFinalQItems, quizChecked, setQuizChecked, quizAnswers),
    };
    const h = handlers[step];
    if (h) { if (!h()) return; }
    goNext();
  };

  const showNext = step < TOTAL_STEPS - 1 && ![2, 3, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19].includes(step);
  const showCheck = [2, 3, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19].includes(step) && step < TOTAL_STEPS - 1;

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={() => router.back()}><MaterialIcons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
        <Text style={styles.xpText}>{xp} XP</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>{renderStep()}</ScrollView>
      {showNext && <TouchableOpacity style={styles.nextBtn} onPress={goNext}><Text style={styles.nextText}>Continuar →</Text></TouchableOpacity>}
      {showCheck && <TouchableOpacity style={styles.nextBtn} onPress={handleMain}><Text style={styles.nextText}>{step === 12 ? (sprintDone ? 'Continuar →' : 'Verificar') : 'Comprobar'}</Text></TouchableOpacity>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  progressBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  progressTrack: { flex: 1, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, marginHorizontal: 12 },
  progressFill: { height: '100%', backgroundColor: '#0891b2', borderRadius: 3 },
  xpText: { fontWeight: 'bold', fontSize: 14, color: '#854d0e' },
  scroll: { padding: 16, paddingBottom: 40 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  iconCircle: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#ecfeff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { ...typography.extraBold, fontSize: 19, color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 18 },
  bodyText: { fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 12 },
  card: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTitle: { fontWeight: 'bold', fontSize: 13, color: '#111827', marginBottom: 4 },
  cardText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  highlight: { borderLeftWidth: 3, borderLeftColor: '#0891b2', borderRadius: 4, padding: 11, marginVertical: 8 },
  highlightText: { color: '#155e75', fontSize: 13, lineHeight: 20 },
  chip: { padding: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff', marginBottom: 4 },
  dropCol: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db', borderRadius: 12, padding: 8, minHeight: 60 },
  sortItem: { flexDirection: 'row', alignItems: 'center', padding: 11, backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 8 },
  sortNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#0891b2', textAlign: 'center', lineHeight: 26, color: '#fff', fontWeight: 'bold', fontSize: 11, marginRight: 9 },
  sortText: { flex: 1, fontSize: 12, color: '#374151' },
  sortArrows: { flexDirection: 'column', gap: 3 },
  sortBtn: { width: 28, height: 26, borderRadius: 7, borderWidth: 1, borderColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' },
  quizQ: { fontWeight: 'bold', fontSize: 13, padding: 11, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  quizOpt: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, marginBottom: 6, gap: 9 },
  quizLetter: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#f3f4f6', textAlign: 'center', lineHeight: 22, fontSize: 10, fontWeight: 'bold' },
  tfQuestion: { fontWeight: 'bold', fontSize: 13, padding: 11, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  tfBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center' },
  optionBtn: { padding: 12, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb', marginBottom: 8, backgroundColor: '#f9fafb' },
  ethOpt: { padding: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  sprintItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#fed7aa', marginBottom: 6, backgroundColor: '#fff' },
  flowOpt: { padding: 7, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff', marginBottom: 4 },
  textArea: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 13, minHeight: 100, textAlignVertical: 'top', marginBottom: 8 },
  nextBtn: { backgroundColor: '#0891b2', padding: 14, margin: 16, borderRadius: 11, alignItems: 'center' },
  nextText: { fontWeight: 'bold', color: '#fff', fontSize: 15 },
  finishBtn: { backgroundColor: '#0891b2', padding: 14, borderRadius: 11, width: '100%', alignItems: 'center', marginTop: 14 },
});