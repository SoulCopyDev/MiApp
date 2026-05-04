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
type SprintItem = { text: string; good: boolean };
type BuilderRow = { key: string; label: string; opts: string[] };

const TOTAL_STEPS = 21; // 0:intro + 19 módulos + 1:complete
const CONTENT_STEPS = 19;

const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

// ===================== POOLS =====================

const MATCH_POOL: MatchPairItem[] = [
  { left: 'Nivel 0', right: 'Manual total: el conductor controla todo. Ningún sistema asiste' },
  { left: 'Nivel 1', right: 'Asistencia básica: control crucero adaptativo o asistente de carril, no ambos' },
  { left: 'Nivel 2', right: 'Automatización parcial: dirección + aceleración a la vez (Tesla Autopilot, GM Super Cruise)' },
  { left: 'Nivel 3', right: 'Autonomía condicional: el auto maneja solo en ciertas condiciones, conductor disponible (Mercedes Drive Pilot)' },
  { left: 'Nivel 4', right: 'Alta autonomía: sin conductor en zonas geográficas específicas (Waymo en Phoenix/SF)' },
  { left: 'Nivel 5', right: 'Autonomía total: maneja en cualquier condición y lugar como humano. NO existe aún en producción' },
];

const SENSORS_POOL: DragItem[] = [
  { text: 'Cámara estéreo · ve ancho de carril y obstáculos visibles', correct: 'vision' },
  { text: 'Radar · mide distancia y velocidad de objetos en 360°', correct: 'distancia' },
  { text: 'Lidar · pulsa rayos láser que crean mapa 3D punto por punto', correct: 'distancia' },
  { text: 'GPS · ubicación absoluta del auto en el mundo', correct: 'ubicacion' },
  { text: 'Ultrasonido · detecta obstáculos a corta distancia (estacionamiento)', correct: 'distancia' },
  { text: 'Sensores inerciales (IMU) · detectan aceleración y rotación', correct: 'ubicacion' },
  { text: 'HD Maps pre-cargados · centímetros de precisión del entorno', correct: 'ubicacion' },
  { text: 'Cámaras de profundidad RGB-D · estiman distancia con visión sola', correct: 'vision' },
];

const ACCIDENTS_Q_POOL: TFItem[] = [
  { stmt: 'Los autos autónomos ya tienen menos accidentes por kilómetro que conductores humanos en TODAS las condiciones', correct: false, explain: 'Falso. Solo en zonas geográficas controladas con clima bueno. Generalizar es engañoso.' },
  { stmt: 'Cualquier accidente de un auto autónomo es noticia mundial; los accidentes humanos NO', correct: true, explain: 'Verdadero. Sesgo de cobertura mediática. ~40,000 muertes en EE.UU./año, casi ninguna es portada nacional.' },
  { stmt: 'Si un auto autónomo causa muerte, está claro legalmente quién es responsable', correct: false, explain: 'Falso. Sigue siendo zona gris legal. Demandas Tesla, Uber y Cruise sin precedentes definitivos.' },
  { stmt: 'Las pruebas de autos autónomos en California han causado más muertes que accidentes humanos en la zona', correct: false, explain: 'Falso. En zonas de operación de Waymo y Cruise, los autónomos tienen tasa de accidentes graves más baja que humanos.' },
  { stmt: 'Los autos autónomos NUNCA fallarán en clima extremo (nieve, lluvia torrencial)', correct: false, explain: 'Falso. Sigue siendo limitación clave. Por eso Waymo solo opera donde el clima es predecible.' },
  { stmt: 'Cruise (GM) suspendió operaciones tras un accidente grave en San Francisco en 2023', correct: true, explain: 'Verdadero. Cruise atropelló a una persona y NO reportó completamente al regulador. Permiso suspendido.' },
  { stmt: 'Tesla está siendo investigada por NHTSA por accidentes de Autopilot', correct: true, explain: 'Verdadero. Investigación abierta desde 2022 sobre 50+ accidentes con Autopilot/FSD activos.' },
  { stmt: 'Los autos autónomos eliminan TODOS los accidentes de tráfico', correct: false, explain: 'Falso. Reducen errores humanos pero no errores ambientales, fallos técnicos o casos imprevistos.' },
];

const FUTURE_AUTO_ITEMS: SprintItem[] = [
  { text: 'Maneja completamente solo a cualquier hora, en cualquier clima', good: true },
  { text: 'Sigue siendo un auto idéntico al de 1995 con ruedas y volante', good: false },
  { text: 'Sin volante ni pedales — interior diseñado para conversar/trabajar', good: true },
  { text: 'Carga inalámbrica mientras conduce en autopistas equipadas', good: true },
  { text: 'Solo puede manejarse a 20 km/h por seguridad excesiva', good: false },
  { text: 'Asientos giratorios que permiten reuniones cara a cara', good: true },
  { text: 'Necesita 8 horas de carga para 50 km de autonomía', good: false },
  { text: 'Comparte datos con otros autos para anticipar tráfico (V2V)', good: true },
  { text: 'Solo lo pueden usar millonarios', good: false },
  { text: 'Adapta su modo según situación: solo, familia, amigos, trabajo móvil', good: true },
];

const NAV_Q_POOL: QuizItem[] = [
  { q: '¿Cómo aprende Google Maps los tiempos de tráfico?', opts: ['Solo de cámaras de la ciudad', 'De los millones de teléfonos Android que envían su ubicación anónima en tiempo real', 'De los policías', 'Lo inventa'], correct: 1, explain: 'Crowdsourcing masivo: cada Android reporta su velocidad. Google promedia eso = mapa de tráfico tiempo real.' },
  { q: '¿Qué hace Waze diferente a Google Maps tradicional?', opts: ['Solo es más barato', 'Reportes en tiempo real de usuarios sobre policías, accidentes, baches — comunidad activa', 'Solo el color', 'Es lo mismo'], correct: 1, explain: 'Waze tiene capa social: usuarios reportan eventos. La IA prioriza alertas según contexto y confianza histórica.' },
  { q: '¿Pueden las apps de navegación predecir tráfico FUTURO?', opts: ['Es magia', 'Sí — entrenan con miles de millones de viajes pasados, predicen patrones por hora/día/clima', 'Adivinan', 'Solo presente'], correct: 1, explain: 'Modelos de ML predicen con 5-15 minutos de anticipación y mejoran continuamente.' },
  { q: '¿Qué pasa si todos los autos siguen la "mejor ruta" que Google sugiere?', opts: ['Todos llegan rápido', 'PARADOJA: la "mejor ruta" deja de serlo porque se llena. Google calcula esto y diversifica recomendaciones', 'Falla la app', 'Nada'], correct: 1, explain: 'Paradoja de Braess + sistemas multi-agente. Algoritmos modernos balancean tráfico distribuyendo recomendaciones.' },
  { q: '¿Por qué Apple Maps fue criticado en 2012?', opts: ['Era muy bueno', 'Lanzó con datos pobres — Apple no tenía la capa de datos crowdsourced que Google había construido en años', 'Era gratis', 'Caro'], correct: 1, explain: 'La calidad de mapas digitales depende MÁS de los datos que del software. Apple ha invertido $10B+ desde entonces.' },
];

const TRANSPORT_Q_POOL: QuizItem[] = [
  { q: '¿Qué empresa lidera en taxis sin conductor REALES (no demos)?', opts: ['Solo Tesla', 'Waymo: 100,000+ viajes semanales sin conductor en Phoenix, SF, LA, Austin (2024)', 'Uber', 'Apple Car'], correct: 1, explain: 'Waymo lidera en operación real con enfoque en seguridad sobre escalabilidad.' },
  { q: 'Diferencia clave entre autos autónomos y trenes autónomos:', opts: ['Color', 'Trenes en vías fijas, sin tráfico mixto, sin peatones cruzando = más fácil de automatizar', 'Solo el peso', 'Trenes no tienen IA'], correct: 1, explain: 'Trenes autónomos llevan operando desde 1987. Autos enfrentan un mundo mucho más caótico.' },
  { q: 'Los drones de delivery en EE.UU. están aprobados por:', opts: ['Nadie', 'FAA (Federal Aviation Administration) bajo regulación Part 135 desde 2020', 'El presidente', 'El Vaticano'], correct: 1, explain: 'FAA regula espacio aéreo. Amazon, Wing y Zipline tienen aprobación para operación comercial.' },
  { q: '¿Cómo se llama un taxi volador eléctrico?', opts: ['Helicóptero', 'eVTOL (Electric Vertical Take-Off and Landing) — Joby, Volocopter, EHang los desarrollan', 'Avión', 'Drone'], correct: 1, explain: 'eVTOL: despegue/aterrizaje vertical sin pista, propulsión eléctrica silenciosa.' },
  { q: '¿Por qué Singapur es referencia mundial en transporte inteligente?', opts: ['Porque es bonito', 'Ciudad-estado pequeña + inversión gubernamental masiva + cultura tecnológica = laboratorio ideal a escala', 'Solo turismo', 'Por moda'], correct: 1, explain: 'Singapur invierte $2B+/año, regula con flexibilidad, mide resultados. Otras ciudades aprenden de su modelo.' },
];

const BUILDER_CITY = {
  xp: 22,
  rows: [
    { key: 'publico', label: 'Sistema de transporte PÚBLICO masivo', opts: ['Metro/tren autónomo 100% (modelo Singapur/Dubai)', 'BRT (buses) con semáforos inteligentes optimizando flujo', 'Tranvía eléctrico autónomo con prioridad en tiempo real', 'Hyperloop entre ciudades para distancias largas'] },
    { key: 'privado', label: 'Movilidad PRIVADA', opts: ['Auto compartido autónomo on-demand (sin propiedad personal)', 'Tesla/Waymo style — propiedad pero auto se conduce solo', 'Bicicletas y patinetes eléctricos compartidos asistidos por IA', 'Sistema 100% multimodal: app que combina opciones según viaje'] },
    { key: 'peatonal', label: 'Sistema PEATONAL', opts: ['Calles peatonales con semáforos que detectan cruces y optimizan', 'Cámaras IA que alertan a conductores cuando hay peatones', 'Aplicación de seguridad personal para zonas inseguras', 'Iluminación adaptativa LED que sigue al peatón nocturno'] },
    { key: 'aereo', label: 'Sistema AÉREO/Drones', opts: ['Delivery por drones para farmacia y emergencias médicas', 'eVTOL (taxi volador) entre aeropuerto y centro ciudad', 'Drones de monitoreo para tráfico, contaminación y seguridad', 'Sin sistema aéreo en esta primera fase'] },
  ],
};

const FILL_POOL: FillItem[] = [
  { sentence: 'El nivel _____ de autonomía es el más alto: maneja en cualquier condición sin intervención humana.', allOpts: ['5', '1', '2', '3'], correct: { fb0: 0 }, explain: 'Nivel 5: autonomía total. NO existe en producción aún. Waymo está en Nivel 4.' },
  { sentence: 'El sensor que crea mapa 3D del entorno con rayos láser se llama _____.', allOpts: ['lidar', 'GPS', 'wifi', 'bluetooth'], correct: { fb0: 0 }, explain: 'Lidar: clave en Waymo, Cruise. Tesla lo eliminó por costo apostando a cámaras.' },
  { sentence: 'Los taxis voladores eléctricos se llaman _____.', allOpts: ['eVTOL', 'BRT', 'TGV', '5G'], correct: { fb0: 0 }, explain: 'eVTOL = Electric Vertical Take-Off and Landing. Joby, Volocopter y EHang son los líderes.' },
  { sentence: 'El sistema de IA que adapta semáforos en tiempo real según tráfico se llama semáforos _____.', allOpts: ['inteligentes', 'antiguos', 'permanentes', 'fijos'], correct: { fb0: 0 }, explain: 'Smart traffic lights: reducen tiempos de viaje 25-40% en Pittsburgh, Singapur.' },
];

// ===================== COMPONENTE =====================
interface LevelProps {
  navigation?: any;
  setAllowBack?: (allow: boolean) => void;
}

export default function World6Level3({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore((s) => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Pools aleatorios
  const [matchPairs] = useState(() => pickN(MATCH_POOL, 5));
  const [sensorsItems] = useState(() => pickN(SENSORS_POOL, 6));
  const [accidentsItems] = useState(() => pickN(ACCIDENTS_Q_POOL, 5));
  const [navQItems] = useState(() => pickN(NAV_Q_POOL, 5));
  const [transportQItems] = useState(() => pickN(TRANSPORT_Q_POOL, 5));
  const [fillItem] = useState(() => pickN(FILL_POOL, 1)[0]);

  // Estados de módulos
  const [matchLeft, setMatchLeft] = useState<number | null>(null);
  const [matchDone, setMatchDone] = useState(0);
  const [rightOrder] = useState(() => matchPairs.map((p) => p.right).sort(() => Math.random() - 0.5));

  const [dragPlaced, setDragPlaced] = useState<Record<number, string>>({});
  const [dragSel, setDragSel] = useState<number | null>(null);
  const [dragAttempts, setDragAttempts] = useState(0);
  const [dragOk, setDragOk] = useState(false);

  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizChecked, setQuizChecked] = useState(false);

  const [tfAnswers, setTfAnswers] = useState<Record<number, boolean>>({});
  const [tfChecked, setTfChecked] = useState(false);

  const [fillSel, setFillSel] = useState<number | null>(null);
  const [fillChecked, setFillChecked] = useState(false);

  const [sprintPicks, setSprintPicks] = useState<Record<number, string>>({});
  const [sprintSec, setSprintSec] = useState(90);
  const [sprintStarted, setSprintStarted] = useState(false);
  const [sprintDone, setSprintDone] = useState(false);
  const sprintTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [builderCity, setBuilderCity] = useState<Record<string, string>>({});

  const [reflectVal, setReflectVal] = useState('');

  const examSteps = new Set([3, 6, 8, 9, 16, 18, 19]);
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
    if (step === 3) { setMatchLeft(null); setMatchDone(0); }
    if (step === 6) { setDragPlaced({}); setDragSel(null); setDragAttempts(0); setDragOk(false); }
    if (step === 8) { setTfAnswers({}); setTfChecked(false); }
    if (step === 9) { setSprintPicks({}); setSprintSec(90); setSprintStarted(false); setSprintDone(false); if (sprintTimer.current) clearInterval(sprintTimer.current); }
    if (step === 16) { setQuizAnswers({}); setQuizChecked(false); }
    if (step === 18) { setQuizAnswers({}); setQuizChecked(false); }
    if (step === 19) { setBuilderCity({}); }
  }, [step]);

  const addXP = (n: number) => setXp((p) => p + n);
  const goNext = () => { if (step < TOTAL_STEPS - 1) setStep(step + 1); };
  const handleClose = () => Alert.alert('Salir', '¿Seguro?', [{ text: 'Cancelar' }, { text: 'Salir', onPress: () => navigation.goBack() }]);
  const handleFinish = () => {
    let stars = 0;
    if (xp >= 180) stars = 3; else if (xp >= 120) stars = 2; else if (xp >= 60) stars = 1;
    completeLevel(6, 3, stars, xp);
    navigation.goBack();
  };

  // Matching
  const matchLeftClick = (i: number) => setMatchLeft(i);
  const matchRightClick = (i: number) => {
    if (matchLeft === null) return;
    if (rightOrder[i] === matchPairs[matchLeft].right) {
      const nd = matchDone + 1; setMatchDone(nd); setMatchLeft(null);
      if (nd >= matchPairs.length) addXP(15);
    } else { Alert.alert('Incorrecto'); setMatchLeft(null); }
  };

  // Drag
  const dropDrag = (idx: number, col: string) => { setDragPlaced((p) => ({ ...p, [idx]: col })); setDragSel(null); };
  const retDrag = (idx: number) => { setDragPlaced((p) => { const n = { ...p }; delete n[idx]; return n; }); };
  const checkDrag = () => {
    if (dragOk) return true;
    if (Object.keys(dragPlaced).length < sensorsItems.length) { Alert.alert('Faltan'); return false; }
    setDragAttempts((p) => p + 1);
    let c = 0; const wrong: number[] = [];
    Object.entries(dragPlaced).forEach(([k, v]) => { const i = parseInt(k); if (v === sensorsItems[i].correct) c++; else wrong.push(i); });
    if (c === sensorsItems.length) { setDragOk(true); addXP(dragAttempts === 0 ? 20 : 10); Alert.alert('¡Genial!', `+${dragAttempts === 0 ? 20 : 10} XP`, [{ text: 'OK', onPress: goNext }]); return false; }
    Alert.alert('Revisa', `${c}/${sensorsItems.length} correctas.`);
    const np = { ...dragPlaced }; wrong.forEach((i) => delete np[i]); setDragPlaced(np);
    return false;
  };

  // Quiz genérico
  const selQuiz = (qi: number, oi: number) => { if (!quizChecked) setQuizAnswers((p) => ({ ...p, [qi]: oi })); };
  const checkQuizGen = (items: QuizItem[]) => {
    if (quizChecked) return true;
    if (Object.keys(quizAnswers).length < items.length) { Alert.alert('Incompleto'); return false; }
    setQuizChecked(true);
    let c = 0;
    items.forEach((q, i) => { if (quizAnswers[i] === q.correct) c++; });
    addXP(c * 8);
    Alert.alert(`${c}/${items.length} correctas`, `+${c * 8} XP`, [{ text: 'OK', onPress: goNext }]);
    return false;
  };

  // TF
  const selTF = (qi: number, v: boolean) => { if (!tfChecked) setTfAnswers((p) => ({ ...p, [qi]: v })); };
  const checkTF = () => {
    if (tfChecked) return true;
    if (Object.keys(tfAnswers).length < accidentsItems.length) { Alert.alert('Incompleto'); return false; }
    setTfChecked(true);
    let c = 0;
    accidentsItems.forEach((q, i) => { if (tfAnswers[i] === q.correct) c++; });
    addXP(c * 5);
    Alert.alert(`${c}/${accidentsItems.length} correctas`, `+${c * 5} XP`, [{ text: 'OK', onPress: goNext }]);
    return false;
  };

  // Fill
  const selFill = (i: number) => { if (!fillChecked) setFillSel(i); };
  const checkFill = () => {
    if (fillChecked) return true;
    if (fillSel === null) { Alert.alert('Elige una opción'); return false; }
    setFillChecked(true);
    if (fillSel === fillItem.correct.fb0) addXP(10);
    Alert.alert(fillSel === fillItem.correct.fb0 ? '✅ +10 XP' : '❌', fillItem.explain);
    return false;
  };

  // Sprint
  const startSprint = () => {
    setSprintStarted(true); setSprintSec(90);
    sprintTimer.current = setInterval(() => {
      setSprintSec((prev) => { if (prev <= 1) { clearInterval(sprintTimer.current!); endSprint(); return 0; } return prev - 1; });
    }, 1000);
  };
  const pickSprint = (i: number) => {
    if (sprintDone || sprintPicks[i] !== undefined) return;
    const item = FUTURE_AUTO_ITEMS[i];
    setSprintPicks((p) => ({ ...p, [i]: item.good ? 'good' : 'bad' }));
    const newPicks = { ...sprintPicks, [i]: item.good ? 'good' : 'bad' };
    const good = Object.values(newPicks).filter((v) => v === 'good').length;
    const totalGood = FUTURE_AUTO_ITEMS.filter((x) => x.good).length;
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

  // Builder
  const selBuilder = (key: string, val: string) => setBuilderCity((p) => ({ ...p, [key]: val }));
  const checkBuilder = () => {
    if (Object.keys(builderCity).length < BUILDER_CITY.rows.length) { Alert.alert('Completa todas las filas'); return false; }
    addXP(BUILDER_CITY.xp);
    return true;
  };

  // Reflexión
  const checkReflect = (minLen: number, xpAward: number) => {
    if (reflectVal.trim().length >= minLen) { addXP(xpAward); return true; }
    Alert.alert(`Mínimo ${minLen} caracteres`);
    return false;
  };

  // ============ RENDER ============
  const renderIntro = () => (
    <View>
      <View style={styles.iconCircle}><Text style={{ fontSize: 34 }}>🚗</Text></View>
      <Text style={styles.title}>IA en Movimiento: Autos y Drones</Text>
      <Text style={styles.subtitle}>Si N32 exploró robots con cuerpo, N33 explora máquinas que se mueven solas. Autos autónomos ya operan en San Francisco. Taxis voladores tienen prototipos reales.</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>📚 Qué vas a aprender</Text><Text style={styles.cardText}>5 niveles de autonomía · Tesla vs Waymo · Sensores reales · Dilema del tranvía · Drones de delivery · Taxis voladores · Semáforos inteligentes · Trenes autónomos.</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>⚡ Qué podrás HACER</Text><Text style={styles.cardText}>Tener visión clara del estado real de la movilidad autónoma 2025-2026 y formar tu opinión informada sobre seguridad, ética y lo que llegará a tu ciudad.</Text></View>
    </View>
  );

  const renderTheory1 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#eff6ff' }]}><Text style={[styles.tagText, { color: '#1e3a8a' }]}>📖 Módulo 1 · Teoría</Text></View>
      <Text style={styles.title}>La movilidad cambió mientras nadie miraba</Text>
      <Text style={styles.bodyText}>Autos sin conductor ya operan en San Francisco. Drones reparten en Texas. Taxis voladores tienen permisos en Dubai.</Text>
      <View style={styles.highlight}><Text style={styles.highlightText}><Text style={{ fontWeight: 'bold' }}>💡 La pregunta clave:</Text> Cuando un humano comete error de tráfico, lo aceptamos. Cuando una máquina lo hace, generamos titulares mundiales. ¿Es justo?</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>🚗 Las 4 categorías de IA en movimiento</Text><Text style={styles.cardText}>1. Autos autónomos: Tesla, Waymo, Cruise.{'\n'}2. Drones de delivery: Amazon, Wing, Zipline.{'\n'}3. Taxis voladores: Joby, Volocopter.{'\n'}4. Trenes y semáforos inteligentes.</Text></View>
    </View>
  );

  const renderReflect = (tag: string, title: string, question: string, placeholder: string, minLen: number, xpLabel: string) => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f3f4f6' }]}><Text style={[styles.tagText, { color: '#374151' }]}>{tag} · +{xpLabel} XP</Text></View>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.card, { backgroundColor: '#faf5ff' }]}>
        <Text style={styles.cardTitle}>🤔 Tu pregunta</Text>
        <Text style={styles.cardText}>{question}</Text>
      </View>
      <TextInput style={styles.textArea} multiline placeholder={placeholder} value={reflectVal} onChangeText={setReflectVal} />
      <Text style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>{reflectVal.length} / {minLen} mínimo</Text>
    </View>
  );

  const renderMatching = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#eff6ff' }]}><Text style={[styles.tagText, { color: '#1e40af' }]}>🔗 Módulo 3 · Matching</Text></View>
      <Text style={styles.title}>Los 5 niveles de autonomía</Text>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        <View style={{ flex: 1 }}>
          {matchPairs.map((p, i) => (
            <TouchableOpacity key={i} style={[styles.matchItem, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }, matchLeft === i && { borderColor: '#1d4ed8', backgroundColor: '#eff6ff' }]} onPress={() => matchLeftClick(i)}>
              <Text style={{ fontSize: 11, color: '#1e40af' }}>{p.left}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          {rightOrder.map((r, i) => (
            <TouchableOpacity key={i} style={[styles.matchItem, { backgroundColor: '#fdf4ff', borderColor: '#e9d5ff' }]} onPress={() => matchRightClick(i)}>
              <Text style={{ fontSize: 10, color: '#5b21b6' }}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {matchDone >= matchPairs.length && <Text style={{ textAlign: 'center', color: '#166534' }}>✅ ¡Todos los pares conectados! +15 XP</Text>}
    </View>
  );

  const renderExpandCards = (cards: { emoji: string; title: string; body: string; fact: string }[], tag: string, title: string) => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fff7ed' }]}><Text style={[styles.tagText, { color: '#9a3412' }]}>{tag}</Text></View>
      <Text style={styles.title}>{title}</Text>
      {cards.map((c, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.cardTitle}>{c.emoji} {c.title}</Text>
          <Text style={styles.cardText}>{c.body}</Text>
          <View style={[styles.highlight, { backgroundColor: '#fffbeb', borderLeftColor: '#f59e0b', marginTop: 6 }]}>
            <Text style={{ color: '#92400e', fontSize: 11 }}>{c.fact}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderDrag = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#eff6ff' }]}><Text style={[styles.tagText, { color: '#1e40af' }]}>🧩 Módulo 6 · Clasificar</Text></View>
      <Text style={styles.title}>¿Qué ve un auto autónomo?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {sensorsItems.map((item, idx) => (
          dragPlaced[idx] === undefined && (
            <TouchableOpacity key={idx} style={[styles.chip, dragSel === idx && { borderColor: '#1d4ed8', backgroundColor: '#eff6ff' }]} onPress={() => setDragSel(dragSel === idx ? null : idx)}>
              <Text style={{ fontSize: 11 }}>{item.text}</Text>
            </TouchableOpacity>
          )
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['vision', 'distancia'] as const).map((col) => (
          <TouchableOpacity key={col} style={[styles.dropCol, { flex: 1 }]} onPress={() => { if (dragSel !== null) dropDrag(dragSel, col); }}>
            <Text style={{ fontWeight: 'bold', fontSize: 11, color: col === 'vision' ? '#1e40af' : '#92400e' }}>{col === 'vision' ? '👁️ Captura visual' : '📏 Mide distancia'}</Text>
            {Object.entries(dragPlaced).filter(([, v]) => v === col).map(([k]) => (
              <TouchableOpacity key={k} style={{ backgroundColor: col === 'vision' ? '#dbeafe' : '#fef3c7', padding: 4, borderRadius: 8, marginTop: 4 }} onPress={() => retDrag(parseInt(k))}>
                <Text style={{ fontSize: 10 }}>{sensorsItems[parseInt(k)].text} ✕</Text>
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderTF = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>✅ Módulo 8 · V/F</Text></View>
      <Text style={styles.title}>Accidentes de autos autónomos · Verdad o mito</Text>
      {accidentsItems.map((item, idx) => (
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

  const renderSprint = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fee2e2' }]}><Text style={[styles.tagText, { color: '#991b1b' }]}>⏱ Módulo 9 · Sprint</Text></View>
      <Text style={styles.title}>Sprint: ¿cómo será el auto del 2035?</Text>
      <Text style={{ fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: sprintSec <= 10 ? '#dc2626' : '#c2410c', marginVertical: 8 }}>{Math.floor(sprintSec / 60)}:{String(sprintSec % 60).padStart(2, '0')}</Text>
      {!sprintStarted && !sprintDone && (
        <TouchableOpacity style={styles.nextBtn} onPress={startSprint}><Text style={styles.nextText}>⚡ Iniciar Sprint</Text></TouchableOpacity>
      )}
      {(sprintStarted || sprintDone) && FUTURE_AUTO_ITEMS.map((item, i) => (
        <TouchableOpacity
          key={i}
          style={[styles.sprintItem, sprintPicks[i] === 'good' && { borderColor: '#16a34a', backgroundColor: '#dcfce7' }, sprintPicks[i] === 'bad' && { borderColor: '#dc2626', backgroundColor: '#fef2f2' }]}
          onPress={() => pickSprint(i)}
          disabled={sprintDone || sprintPicks[i] !== undefined}
        >
          <Text style={{ flex: 1, fontSize: 11 }}>{item.text}</Text>
          <Text style={{ fontWeight: 'bold', fontSize: 11 }}>{sprintPicks[i] === 'good' ? '✅' : sprintPicks[i] === 'bad' ? '❌' : ''}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderQuiz = (items: QuizItem[], tag: string, title: string) => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>{tag}</Text></View>
      <Text style={styles.title}>{title}</Text>
      {items.map((q, qi) => (
        <View key={qi} style={{ marginBottom: 14 }}>
          <Text style={styles.quizQ}>{qi + 1}. {q.q}</Text>
          {q.opts.map((opt, oi) => (
            <TouchableOpacity key={oi} style={[styles.quizOpt, quizAnswers[qi] === oi && { borderColor: '#1d4ed8', backgroundColor: '#eff6ff' }]} onPress={() => selQuiz(qi, oi)} disabled={quizChecked}>
              <Text style={styles.quizLetter}>{String.fromCharCode(65 + oi)}</Text>
              <Text style={{ flex: 1, fontSize: 12 }}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );

  const renderBuilderCity = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#eff6ff' }]}><Text style={[styles.tagText, { color: '#1e3a8a' }]}>🏙️ Módulo 19 · Builder</Text></View>
      <Text style={styles.title}>Diseña tu ciudad con movilidad IA</Text>
      {BUILDER_CITY.rows.map((row) => (
        <View key={row.key} style={{ marginBottom: 10 }}>
          <Text style={{ fontWeight: 'bold', color: '#1e3a8a', marginBottom: 4 }}>{row.label}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            {row.opts.map((opt) => (
              <TouchableOpacity key={opt} style={[styles.flowOpt, builderCity[row.key] === opt && { borderColor: '#1d4ed8', backgroundColor: '#eff6ff' }]} onPress={() => selBuilder(row.key, opt)}>
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
      <Text style={{ fontSize: 56 }}>🚗</Text>
      <Text style={[styles.title, { textAlign: 'center' }]}>¡Nivel 33 completado!</Text>
      <Text style={[styles.subtitle, { textAlign: 'center' }]}>Terminaste "IA en Movimiento: Autos y Drones". Ahora eres Mobility Innovator.</Text>
      <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#1d4ed8', marginVertical: 12 }}>⭐ {xp} XP</Text>
      <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Volver al mapa</Text></TouchableOpacity>
    </View>
  );

  // ============ RENDER PRINCIPAL ============
  const renderStep = () => {
    switch (step) {
      case 0: return renderIntro();
      case 1: return renderTheory1();
      case 2: return renderReflect('🤔 Tu confianza', 'Piensa tú', '¿Confiarías en un auto que se maneja solo? ¿Desde qué edad lo dejarías llevar a tu familia? ¿Por qué confías más o menos en una máquina vs un humano?', 'Confío más/menos en una máquina que en humano porque...', 80, '14');
      case 3: return renderMatching();
      case 4: return renderExpandCards([
        { emoji: '🚙', title: 'Tesla Autopilot · Visión por computador', body: 'Apuesta SOLO por cámaras + redes neuronales, sin lidar ni radar. ~10 millones de Teslas envían telemetría continua.', fact: '⭐ Crítica: Tesla llamarlo "Full Self-Driving" es engañoso — sigue siendo Nivel 2 técnicamente.' },
        { emoji: '🤖', title: 'Tesla FSD (Full Self-Driving)', body: 'Nivel más avanzado de Tesla. Versión 12 usa red neuronal end-to-end. Costo: $8,000-$12,000 USD.', fact: '⭐ Tesla tiene varias demandas en EE.UU. por marketing engañoso.' },
        { emoji: '📊', title: 'Datos de seguridad reales de Tesla', body: '1 accidente cada ~10M km con FSD activo vs ~1 cada 1M km promedio EE.UU. Pero datos son auto-reportados.', fact: '⭐ NHTSA investiga 50+ accidentes con Autopilot activado, varios fatales.' },
      ], '🚗 Módulo 4 · Tesla', 'Tesla Autopilot · Cámaras + IA, sin lidar');
      case 5: return renderExpandCards([
        { emoji: '🚖', title: 'Waymo · El taxi sin conductor real', body: 'Opera servicio comercial sin conductor en Phoenix, SF, LA y Austin. 100,000+ viajes semanales.', fact: '⭐ Usa lidar + cámaras + radar + HD maps. Más caro pero más robusto.' },
        { emoji: '📈', title: 'Waymo vs accidentes humanos', body: '~80% menos accidentes con airbag activado que conductores humanos en misma área geográfica.', fact: '⭐ El número es real pero cualificado: opera en geografías limitadas con clima bueno.' },
        { emoji: '🚧', title: 'Limitaciones reales de Waymo', body: 'Aún no opera bien en nieve fuerte, lluvia torrencial, zonas mal mapeadas.', fact: '⭐ El reto NO es la IA — es escalar geografías nuevas con HD maps confiables.' },
      ], '🚖 Módulo 5 · Waymo', 'Waymo · El taxi sin conductor real');
      case 6: return renderDrag();
      case 7: return renderReflect('💔 Dilema del tranvía', 'Piensa tú', 'Si el accidente es inevitable, ¿el auto debería priorizar a sus pasajeros, a peatones, a niños? ¿Quién debería tomar esta decisión — el fabricante, el conductor, el regulador, una IA?', 'Quien debería decidir es... Yo priorizaría... porque...', 120, '16');
      case 8: return renderTF();
      case 9: return renderSprint();
      case 10: return renderExpandCards([
        { emoji: '📦', title: 'Amazon Prime Air · Aprobado por FAA', body: 'Opera comercialmente en College Station (Texas) y Lockeford (California). Drones cargan hasta 2.3 kg, vuelan 25 km.', fact: '⭐ En 2024 ya hacen cientos de entregas semanales.' },
        { emoji: '🇦🇺', title: 'Wing (Google) · Líder global', body: 'Opera en Australia, Texas, Virginia y Finlandia. 200,000+ entregas comerciales hasta 2024.', fact: '⭐ Wing busca expansión LATAM 2025-2026. Bogotá y Medellín han sido evaluadas.' },
        { emoji: '🍕', title: 'Zipline · El líder en África', body: 'Empezó entregando sangre y medicinas en Ruanda y Ghana. Hoy también opera en Japón y EE.UU. 1M+ entregas reales.', fact: '⭐ Lección: empezar resolviendo problema crítico genera regulación favorable.' },
      ], '📦 Módulo 10 · Drones delivery', 'Drones de delivery · Ya en producción');
      case 11: return renderReflect('🪖 Ética militar', 'Piensa tú', 'Los drones militares autónomos ya existen. ¿Es siempre éticamente inaceptable un dron militar autónomo? ¿O hay casos defendibles? ¿Qué reglas mínimas deberían existir?', 'Creo que es siempre/a veces aceptable porque... Las reglas mínimas serían...', 130, '18');
      case 12: return renderExpandCards([
        { emoji: '🚁', title: 'Joby Aviation · El más avanzado', body: 'Certificación tipo de FAA en proceso. 4 pasajeros + 1 piloto, 240 km/h, 240 km de rango.', fact: '⭐ Inversores: Toyota, SK Telecom, Delta Airlines, Uber.' },
        { emoji: '🇦🇪', title: 'Volocopter · El operador más cerca', body: 'Primera demostración pública en Dubai 2023. Plan: operar comercialmente desde Expo 2025.', fact: '⭐ Aeropuerto Dubai → palmera Jumeirah en 8 minutos. Costo estimado: $100-300 USD.' },
        { emoji: '🇨🇳', title: 'EHang · El primero en certificarse', body: 'Primera certificación tipo del mundo para eVTOL autónomo (sin piloto) en 2023.', fact: '⭐ China lidera en regulación de eVTOL autónomo. Primer mercado real con servicio comercial.' },
      ], '🚁 Módulo 12 · eVTOL', 'Taxis voladores · Joby, Volocopter, EHang');
      case 13: return renderExpandCards([
        { emoji: '🚦', title: 'Pittsburgh · Surtrac', body: 'Sistema que adapta semáforos en tiempo real con IA. Reducción de tiempos de viaje 25-40%, emisiones 21%.', fact: '⭐ Costo: $20K-50K USD por intersección, ROI en 18-36 meses.' },
        { emoji: '🇸🇬', title: 'Singapur · Smart Nation', body: 'Red nacional de IA en transporte. Invierte ~$2B USD/año en infraestructura inteligente.', fact: '⭐ Ciudad-estado entera como laboratorio. Datos públicos disponibles para investigadores.' },
        { emoji: '🇨🇴', title: 'Bogotá · Sistemas básicos en pruebas', body: 'Semáforos adaptativos en TransMilenio y zonas piloto desde 2020. Reducción de viaje 15% en horas valle.', fact: '⭐ El reto LATAM: reemplazar miles de semáforos viejos. Decisión política, no técnica.' },
      ], '🚦 Módulo 13 · Semáforos IA', 'Semáforos que piensan en tiempo real');
      case 14: return renderReflect('🇨🇴 Tu ciudad', 'Piensa tú', '¿Crees que tu ciudad tendrá autos autónomos comerciales en 5, 15, 30 años o nunca? ¿Cuáles serían los obstáculos REALES más allá de la tecnología?', 'En mi ciudad creo que llegará en... porque los obstáculos REALES son...', 120, '18');
      case 15: return renderExpandCards([
        { emoji: '🇸🇬', title: 'Singapur · 100% sin conductor desde 1987', body: 'MRT de Singapur opera sin conductor desde su apertura. 1.6M viajeros diarios.', fact: '⭐ Cuando construyes desde cero, automatización es natural. Retrofit es lo difícil.' },
        { emoji: '🇦🇪', title: 'Dubai Metro · El más largo sin conductor', body: '89.6 km de red 100% autónoma, el más largo del mundo. Operativo desde 2009.', fact: '⭐ Modelo financiero: $7.6B USD invertidos. Recuperan vía publicidad + tarifa baja.' },
        { emoji: '🇪🇺', title: 'Trenes de larga distancia · Europa avanza', body: 'Deutsche Bahn hizo demos de trenes autónomos de carga en 2024. Italia ya opera Frecciarossa con asistencia IA.', fact: '⭐ Trenes son el caso "fácil": vías fijas, sin peatones, sin tráfico mixto.' },
      ], '🚆 Módulo 15 · Trenes', 'Trenes sin conductor · Ya llevan décadas');
      case 16: return renderQuiz(navQItems, '❓ Módulo 16 · Quiz', 'Cómo aprenden Google Maps y Waze');
      case 17: return renderExpandCards([
        { emoji: '📊', title: 'Las cifras crudas', body: 'EE.UU. tiene ~40,000 muertes anuales en accidentes. ~94% son por error humano.', fact: '⭐ Incluso autonomía imperfecta puede reducir muertes totales si reemplaza conductores promedio.' },
        { emoji: '⚠️', title: 'Lo que aún falla', body: 'Condiciones climáticas extremas, situaciones impredecibles, interpretación de gestos humanos.', fact: '⭐ La pregunta NO es "¿son perfectos?" sino "¿son mejores que conductores humanos promedio?".' },
        { emoji: '💔', title: 'El caso Uber 2018 · Punto de inflexión', body: 'Auto autónomo de Uber atropelló mortalmente a Elaine Herzberg. La conductora estaba viendo Hulu.', fact: '⭐ Resultado: Uber abandonó autonomía vehicular en 2020. La cultura de seguridad importa tanto como la IA.' },
      ], '📊 Módulo 17 · Seguridad', '¿Son seguros los autos autónomos?');
      case 18: return renderQuiz(transportQItems, '❓ Módulo 18 · Quiz', 'Quiz · Transporte inteligente');
      case 19: return renderBuilderCity();
      case 20: return renderCompletion();
      default: return null;
    }
  };

  const progress = (step / (TOTAL_STEPS - 1)) * 100;

  const handleMain = () => {
    const handlers: Record<number, (() => boolean) | undefined> = {
      2: () => checkReflect(80, 14),
      3: () => matchDone >= matchPairs.length,
      6: checkDrag,
      7: () => checkReflect(120, 16),
      8: checkTF,
      9: () => sprintDone,
      11: () => checkReflect(130, 18),
      14: () => checkReflect(120, 18),
      16: () => checkQuizGen(navQItems),
      18: () => checkQuizGen(transportQItems),
      19: checkBuilder,
    };
    const h = handlers[step];
    if (h) { if (!h()) return; }
    goNext();
  };

  const showNext = step < TOTAL_STEPS - 1 && ![2, 3, 6, 7, 8, 9, 11, 14, 16, 18, 19].includes(step);
  const showCheck = [2, 3, 6, 7, 8, 9, 11, 14, 16, 18, 19].includes(step) && step < TOTAL_STEPS - 1;

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={handleClose}><MaterialIcons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
        <Text style={styles.xpText}>{xp} XP</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>{renderStep()}</ScrollView>
      {showNext && <TouchableOpacity style={styles.nextBtn} onPress={goNext}><Text style={styles.nextText}>Continuar →</Text></TouchableOpacity>}
      {showCheck && <TouchableOpacity style={styles.nextBtn} onPress={handleMain}><Text style={styles.nextText}>Comprobar</Text></TouchableOpacity>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  progressBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  progressTrack: { flex: 1, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, marginHorizontal: 12 },
  progressFill: { height: '100%', backgroundColor: '#1d4ed8', borderRadius: 3 },
  xpText: { fontWeight: 'bold', fontSize: 14, color: '#854d0e' },
  scroll: { padding: 16, paddingBottom: 40 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  iconCircle: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { ...typography.extraBold, fontSize: 19, color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 18 },
  bodyText: { fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 12 },
  card: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTitle: { fontWeight: 'bold', fontSize: 13, color: '#111827', marginBottom: 4 },
  cardText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  highlight: { borderLeftWidth: 3, borderLeftColor: '#1d4ed8', borderRadius: 4, padding: 11, marginVertical: 8 },
  highlightText: { color: '#1e3a8a', fontSize: 13, lineHeight: 20 },
  chip: { padding: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff', marginBottom: 4 },
  dropCol: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db', borderRadius: 12, padding: 8, minHeight: 60 },
  matchItem: { padding: 10, borderRadius: 10, borderWidth: 1.5, marginBottom: 4, minHeight: 50, justifyContent: 'center' },
  quizQ: { fontWeight: 'bold', fontSize: 13, padding: 11, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  quizOpt: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, marginBottom: 6, gap: 9 },
  quizLetter: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#f3f4f6', textAlign: 'center', lineHeight: 22, fontSize: 10, fontWeight: 'bold' },
  tfQuestion: { fontWeight: 'bold', fontSize: 13, padding: 11, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  tfBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center' },
  sprintItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#fed7aa', marginBottom: 6, backgroundColor: '#fff' },
  flowOpt: { padding: 7, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff', marginBottom: 4 },
  textArea: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 13, minHeight: 100, textAlignVertical: 'top', marginBottom: 8 },
  nextBtn: { backgroundColor: '#1d4ed8', padding: 14, margin: 16, borderRadius: 11, alignItems: 'center' },
  nextText: { fontWeight: 'bold', color: '#fff', fontSize: 15 },
  finishBtn: { backgroundColor: '#1d4ed8', padding: 14, borderRadius: 11, width: '100%', alignItems: 'center', marginTop: 14 },
});