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
type BuilderRow = { key: string; label: string; opts: string[] };

const TOTAL_STEPS = 21; // 0:intro + 19 módulos + 1:complete
const CONTENT_STEPS = 19;

const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

// ===================== POOLS =====================

const MATCH_POOL: MatchPairItem[] = [
  { left: 'Cámara que detecta una taza en la mesa', right: 'Sensor: convierte luz en datos digitales para que la IA los procese' },
  { left: 'Red neuronal que reconoce "eso es una taza"', right: 'IA: procesa los datos del sensor y decide qué hacer' },
  { left: 'Motor que mueve el brazo robótico hacia la taza', right: 'Actuador: ejecuta físicamente la decisión de la IA' },
  { left: 'Sensor de presión en los dedos del robot', right: 'Sensor táctil: dice cuánta fuerza aplicar al agarrar' },
  { left: 'Algoritmo que decide ruta esquivando obstáculos', right: 'IA de planificación: calcula trayectorias en tiempo real' },
  { left: 'Servomotores que generan caminado bípedo', right: 'Actuadores: convierten señales eléctricas en movimiento físico' },
  { left: 'Lidar 360° para mapear ambiente', right: 'Sensor avanzado: crea mapa 3D del entorno' },
  { left: 'Modelo de visión que detecta caída inminente', right: 'IA reactiva: ajusta equilibrio en milisegundos' },
];

const PURPOSE_Q_POOL: QuizItem[] = [
  { q: '¿Por qué los robots para fábricas son humanoides en vez de tener forma optimizada?', opts: ['Por moda', 'Porque las fábricas están diseñadas para humanos — un humanoide encaja sin rediseñar todo el espacio', 'Es más barato', 'Es ley'], correct: 1, explain: 'Inversión enorme en infraestructura humana ya existe. Robot humanoide = encaja en mundo humano sin rediseñar nada.' },
  { q: 'Caso real donde el humanoide es claramente útil:', opts: ['En la luna', 'En fábricas con tareas repetitivas peligrosas: BMW + Figure 02 ensamblando autos', 'En la cocina', 'En videojuegos'], correct: 1, explain: 'BMW Spartanburg desde 2024: Figure 02 hace inserción de pernos. Trabajo repetitivo + alta precisión = caso de uso ideal.' },
  { q: '¿En qué tipo de hospital ya hay robots autónomos asistiendo?', opts: ['En ninguno', 'Quirófanos: Da Vinci hace cirugías mínimamente invasivas con precisión sub-milimétrica', 'Solo en cafetería', 'Solo limpiando'], correct: 1, explain: 'Da Vinci de Intuitive Surgical: 14M+ procedimientos realizados desde 2000. Operado por cirujano humano, pero la precisión la da el robot.' },
  { q: '¿Qué robots están explorando otros planetas HOY?', opts: ['Ninguno', 'Perseverance (Marte desde 2021), Curiosity (Marte), e Ingenuity (helicóptero marciano hasta 2024)', 'Solo en cine', 'En la luna desde 1969'], correct: 1, explain: 'NASA tiene 4 rovers exitosos en Marte. Perseverance toma muestras para misión de retorno futura.' },
  { q: '¿Por qué Japón apuesta fuerte por robots de cuidado de mayores?', opts: ['Tradición', 'Pirámide poblacional invertida — más mayores que jóvenes, escasez crítica de cuidadores humanos', 'Por tecnología', 'Por moda'], correct: 1, explain: 'Japón: 28% mayores de 65 años. Sin suficientes cuidadores humanos, la única solución viable es tecnológica.' },
  { q: 'Limitación más grande de robots humanoides actuales (2025-2026):', opts: ['Que no son rápidos', 'BATERÍA: 4-5 horas máximo. Cargas largas limitan operación continua', 'El precio', 'El idioma'], correct: 1, explain: 'Operar 24/7 requiere o cambio de baterías o carga inalámbrica eficiente. Actualmente 4-5h de operación + 1-2h de carga es lo común.' },
];

const RL_Q_POOL: QuizItem[] = [
  { q: '¿Cómo aprende un robot bípedo a caminar?', opts: ['Lo programan paso a paso', 'En simulación, intenta millones de veces, recibe "recompensa" cuando avanza sin caer, ajusta', 'Mira videos', 'Lee libros'], correct: 1, explain: 'Aprendizaje por refuerzo (RL): el robot prueba acciones, recibe feedback (éxito/fracaso) y ajusta su política. En simulación, no se daña al fallar.' },
  { q: '¿Cuántos "intentos" puede hacer un robot en simulación antes de probarse físicamente?', opts: ['10 veces', 'Millones — equivalente a años de práctica humana en horas/días reales', 'Ninguno', 'Una sola'], correct: 1, explain: 'La simulación es paralela y rápida. 1 hora de cómputo = años de "experiencia" humana.' },
  { q: 'El término técnico para entrenar robot en simulación antes de mundo real:', opts: ['Real-time', 'Sim-to-real transfer (transferencia simulación-a-real): el reto es que la simulación NO sea perfecta', 'Cloud-only', 'Beta'], correct: 1, explain: 'Sim-to-real es el problema técnico clave. La simulación nunca refleja perfectamente la realidad.' },
  { q: '¿Qué pasó con AlphaGo aplicado a movimiento físico?', opts: ['Nada', 'DeepMind aplicó la misma tecnología a manipulación robótica — surgió el campo del "Robot Foundation Model"', 'Solo Go', 'Falló'], correct: 1, explain: 'Robot Foundation Models: modelos pre-entrenados en MUCHAS tareas robóticas que generalizan a tareas nuevas.' },
  { q: 'Razón por la que entrenar robot 100% en mundo real es impráctico:', opts: ['Costo bajo', 'Robots se rompen, los humanos se cansan supervisando, y necesitas espacios físicos enormes para iteración masiva', 'Es ilegal', 'Da igual'], correct: 1, explain: 'Imitación + simulación + RL = combo ganador. Solo el último 5-10% se entrena en mundo real para refinar.' },
];

const ADVANCED_Q_POOL: QuizItem[] = [
  { q: 'Robot humanoide que ya está en producción industrial real (BMW):', opts: ['Atlas', 'Figure 02 desde 2024', 'Robonaut', 'Pepper'], correct: 1, explain: 'Figure 02 + BMW Spartanburg = primer humanoide en línea de ensamblaje automotriz a escala.' },
  { q: 'Empresa que más invierte en humanoides actualmente:', opts: ['Solo Boston Dynamics', 'Múltiples: Tesla (Optimus), Figure (con OpenAI), 1X (con OpenAI), Apptronik, Sanctuary, Unitree — competencia masiva 2024-2026', 'Solo Tesla', 'Solo Honda'], correct: 1, explain: 'Boom 2024-2026: 10+ startups serias + Tesla + chinos. Inversión total >$10B USD.' },
  { q: 'Modelo de IA específico para robótica en 2024:', opts: ['No existen', 'RT-2 (Google), Gemini Robotics, Pi-0, Helix (Figure) — modelos foundation para acción física', 'Solo GPT-4', 'Solo Siri'], correct: 1, explain: 'Robot Foundation Models: pre-entrenados en muchas tareas físicas, generalizan a nuevas.' },
  { q: 'Tarea que hoy humanoides hacen MEJOR que humanos:', opts: ['Conversar', 'Tareas repetitivas con precisión durante 4-5 horas continuas sin cansancio', 'Crear arte', 'Sentir emociones'], correct: 1, explain: 'Resistencia y consistencia. Donde un humano se cansa o aburre tras 2 horas, un humanoide mantiene precisión.' },
  { q: 'Tarea que hoy humanoides hacen PEOR que humanos:', opts: ['Levantar pesado', 'Manipulación fina y delicada (ej: pelar fruta, atar cordones, doblar ropa)', 'Caminar', 'Cargar batería'], correct: 1, explain: 'Manipulación delicada con feedback táctil sutil sigue siendo difícil.' },
];

const ETHICS_Q_POOL: TFItem[] = [
  { stmt: 'Si un robot autónomo causa un accidente, el responsable legal está claramente definido en todos los países', correct: false, explain: 'Falso. La responsabilidad legal sigue siendo zona gris: ¿fabricante? ¿programador? ¿usuario?' },
  { stmt: 'Las 3 leyes de la robótica de Asimov se usan como base legal real en algún país', correct: false, explain: 'Falso. Son ficción literaria, no marco legal.' },
  { stmt: 'Robots militares autónomos letales (LAWS) ya existen y se debaten en ONU', correct: true, explain: 'Verdadero. ONU debate prohibición de Lethal Autonomous Weapons Systems.' },
  { stmt: 'Un robot que monitorea adultos mayores debe siempre alertar a familiares de cualquier comportamiento inusual', correct: false, explain: 'Falso. Privacidad del mayor también importa. Configuración matizada: emergencias → familia; comportamiento normal → privado.' },
  { stmt: 'Es ético usar robots para reemplazar trabajadores humanos en tareas peligrosas', correct: true, explain: 'Verdadero — generalmente aceptado. Reducir lesiones laborales y muertes = bien social.' },
  { stmt: 'Los humanoides domésticos NUNCA deberían tener acceso a información privada de la familia', correct: false, explain: 'Falso. Para ser útiles, NECESITAN contexto. La pregunta es "cómo", no "si".' },
  { stmt: 'Robots pueden tomar decisiones de fin de vida en hospitales para evitar "sesgos humanos"', correct: false, explain: 'Falso. Decisiones bioéticas profundas requieren juicio humano.' },
  { stmt: 'Sistemas de IA militares autónomos pueden ser más éticos que soldados humanos porque no tienen miedo, ira ni venganza', correct: false, explain: 'Posición controvertida. ICRC y ONU defienden control humano significativo.' },
];

const SENSORS_POOL: DragItem[] = [
  { text: 'Cámaras estéreo (2+ ángulos)', correct: 'vista' },
  { text: 'Lidar (rayos láser que miden distancias)', correct: 'vista' },
  { text: 'Sensor de profundidad (RGB-D)', correct: 'vista' },
  { text: 'Micrófonos direccionales', correct: 'audio' },
  { text: 'Sensores piezoeléctricos en dedos', correct: 'tacto' },
  { text: 'Galgas extensiométricas (force sensors)', correct: 'tacto' },
  { text: 'Acelerómetro 3-axis (IMU)', correct: 'equilibrio' },
  { text: 'Giroscopio para orientación', correct: 'equilibrio' },
  { text: 'Sensores térmicos infrarrojos', correct: 'temperatura' },
  { text: 'Termómetros internos para cada motor', correct: 'temperatura' },
];

const FILL_POOL: FillItem[] = [
  { sentence: 'El ciclo básico de toda robótica es _____ → IA → Actuador.', allOpts: ['Sensor', 'Motor', 'Software', 'Pantalla'], correct: { fb0: 0 }, explain: 'Sensor capta datos del ambiente, IA decide qué hacer, Actuador ejecuta. Ciclo universal en toda la robótica.' },
  { sentence: 'El método donde un robot aprende caminando millones de veces en simulación antes del mundo real se llama aprendizaje por _____.', allOpts: ['refuerzo', 'memoria', 'imitación', 'supervisión'], correct: { fb0: 0 }, explain: 'Reinforcement Learning: prueba acciones, recibe recompensa cuando logra objetivo, ajusta política.' },
  { sentence: 'Los humanoides industriales ya en producción real demuestran que la robótica está pasando de prototipo a _____.', allOpts: ['producto', 'fantasía', 'prototipo', 'ficción'], correct: { fb0: 0 }, explain: 'Producto comercial real. Stretch, Da Vinci, Figure 02, Spot ya operan en producción, no son demos.' },
  { sentence: 'Sistemas militares autónomos letales (que matan sin control humano) se llaman _____.', allOpts: ['LAWS', 'API', 'WIFI', 'RAM'], correct: { fb0: 0 }, explain: 'Lethal Autonomous Weapons Systems. ONU debate restringirlos.' },
];

const BUILDER_CITY = {
  xp: 22,
  rows: [
    { key: 'problema', label: 'Problema urbano que resuelve', opts: ['Recoger basura en calles peatonales sin contaminación sonora', 'Reparto en zonas con mucho tráfico', 'Vigilar calles inseguras de noche con sensores', 'Riego automático y mantenimiento de parques urbanos', 'Inspección de infraestructura (puentes, túneles)'] },
    { key: 'forma', label: 'Forma física', opts: ['Cuadrúpedo tipo Spot (ágil en escaleras)', 'Vehículo rodante (rápido en calles planas)', 'Drone aéreo (sin tráfico, vista superior)', 'Bípedo humanoide (encaja en infraestructura humana)', 'Híbrido rodante-volador'] },
    { key: 'sensor', label: 'Sensor más crítico', opts: ['Cámaras estéreo + Lidar para navegación robusta', 'Sensores químicos + olfativos (gases, contaminantes)', 'Micrófonos direccionales (detección de gritos, alarmas)', 'Sensores ambientales (calidad aire, temperatura)', 'GPS + comunicación 5G para coordinación'] },
    { key: 'operacion', label: 'Modelo de operación', opts: ['24/7 con relevo de baterías en estaciones de carga', 'Operación por turnos con recarga nocturna', 'Por demanda (responde a llamadas/alertas)', 'En enjambre — múltiples unidades coordinadas'] },
  ],
};

// ===================== COMPONENTE =====================
interface LevelProps {
  navigation?: any;
  setAllowBack?: (allow: boolean) => void;
}

export default function World6Level1({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore((s) => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Pools aleatorios
  const [matchPairs] = useState(() => pickN(MATCH_POOL, 5));
  const [purposeQItems] = useState(() => pickN(PURPOSE_Q_POOL, 5));
  const [rlQItems] = useState(() => pickN(RL_Q_POOL, 5));
  const [advancedQItems] = useState(() => pickN(ADVANCED_Q_POOL, 5));
  const [ethicsItems] = useState(() => pickN(ETHICS_Q_POOL, 5));
  const [sensorsItems] = useState(() => pickN(SENSORS_POOL, 6));
  const [fillItem] = useState(() => pickN(FILL_POOL, 1)[0]);

  // Estados de módulos
  const [matchLeft, setMatchLeft] = useState<number | null>(null);
  const [matchDone, setMatchDone] = useState(0);
  const [rightOrder] = useState(() => matchPairs.map((p) => p.right).sort(() => Math.random() - 0.5));

  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizChecked, setQuizChecked] = useState(false);

  const [tfAnswers, setTfAnswers] = useState<Record<number, boolean>>({});
  const [tfChecked, setTfChecked] = useState(false);

  const [fillSel, setFillSel] = useState<number | null>(null);
  const [fillChecked, setFillChecked] = useState(false);

  const [dragPlaced, setDragPlaced] = useState<Record<number, string>>({});
  const [dragSel, setDragSel] = useState<number | null>(null);
  const [dragAttempts, setDragAttempts] = useState(0);
  const [dragOk, setDragOk] = useState(false);

  const [builderCity, setBuilderCity] = useState<Record<string, string>>({});

  const [compareChoice, setCompareChoice] = useState<string | null>(null);
  const [compareChecked, setCompareChecked] = useState(false);

  const [reflectVal, setReflectVal] = useState('');

  const examSteps = new Set([3, 6, 9, 10, 13, 16, 17, 18]);
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
    if (step === 6) { setQuizAnswers({}); setQuizChecked(false); }
    if (step === 9) { setQuizAnswers({}); setQuizChecked(false); }
    if (step === 10) { setDragPlaced({}); setDragSel(null); setDragAttempts(0); setDragOk(false); }
    if (step === 13) { setQuizAnswers({}); setQuizChecked(false); }
    if (step === 16) { setCompareChoice(null); setCompareChecked(false); }
    if (step === 17) { setTfAnswers({}); setTfChecked(false); }
    if (step === 18) { setBuilderCity({}); }
  }, [step]);

  const addXP = (n: number) => setXp((p) => p + n);
  const goNext = () => { if (step < TOTAL_STEPS - 1) setStep(step + 1); };
  const handleClose = () => Alert.alert('Salir', '¿Seguro?', [{ text: 'Cancelar' }, { text: 'Salir', onPress: () => router.back() }]);
  const handleFinish = () => {
    let stars = 0;
    if (xp >= 180) stars = 3; else if (xp >= 120) stars = 2; else if (xp >= 60) stars = 1;
    completeLevel(6, 1, stars, xp);
    router.back();
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
    if (Object.keys(tfAnswers).length < ethicsItems.length) { Alert.alert('Incompleto'); return false; }
    setTfChecked(true);
    let c = 0;
    ethicsItems.forEach((q, i) => { if (tfAnswers[i] === q.correct) c++; });
    addXP(c * 5);
    Alert.alert(`${c}/${ethicsItems.length} correctas`, `+${c * 5} XP`, [{ text: 'OK', onPress: goNext }]);
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

  // Builder
  const selBuilder = (key: string, val: string) => setBuilderCity((p) => ({ ...p, [key]: val }));
  const checkBuilder = () => {
    if (Object.keys(builderCity).length < BUILDER_CITY.rows.length) { Alert.alert('Completa todas las filas'); return false; }
    addXP(BUILDER_CITY.xp);
    return true;
  };

  // Compare
  const pickCompare = (which: string) => { if (!compareChecked) setCompareChoice(which); };
  const checkCompare = () => {
    if (compareChecked) return true;
    if (!compareChoice) { Alert.alert('Elige uno'); return false; }
    setCompareChecked(true);
    if (compareChoice === 'b') addXP(12);
    Alert.alert(compareChoice === 'b' ? '✅ +12 XP' : '❌', 'El moderno gana: foundation models robóticos entrenan en miles de escenarios reales. La generalización beats programación específica.');
    return false;
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
      <View style={styles.iconCircle}><Text style={{ fontSize: 34 }}>🦾</Text></View>
      <Text style={styles.title}>Robótica e IA: El Cuerpo de la IA</Text>
      <Text style={styles.subtitle}>Si N31 exploró la mente que piensa sola, N32 explora el cuerpo que se mueve solo. La IA tiene cerebro; la robótica le da cuerpo.</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>📚 Qué vas a aprender</Text><Text style={styles.cardText}>Ciclo Sensor → IA → Actuador · Boston Dynamics, Figure, Tesla Bot · Aprendizaje por refuerzo · Cirugía robótica · Robots espaciales · Cuidado de mayores · Drones y submarinos.</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>⚡ Qué podrás HACER</Text><Text style={styles.cardText}>Tener visión clara del estado real de la robótica 2025-2026, distinguir lo que ya existe de la ciencia ficción, y formar tu opinión informada sobre el futuro inmediato.</Text></View>
    </View>
  );

  const renderTheory1 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f8fafc' }]}><Text style={[styles.tagText, { color: '#1e293b' }]}>📖 Módulo 1 · Teoría</Text></View>
      <Text style={styles.title}>El cuerpo de la IA</Text>
      <Text style={styles.bodyText}>La IA tiene cerebro; la robótica le da <Text style={{ fontWeight: 'bold' }}>cuerpo</Text>. Y eso cambia todo.</Text>
      <View style={styles.highlight}><Text style={styles.highlightText}><Text style={{ fontWeight: 'bold' }}>💡 El ciclo básico de toda robótica:</Text> 1. SENSOR capta datos del ambiente. 2. IA procesa y decide qué hacer. 3. ACTUADOR ejecuta la decisión físicamente.</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>🤖 Las 4 categorías de robots reales hoy</Text><Text style={styles.cardText}>1. Industriales: Stretch, Figure 02 en BMW.{'\n'}2. Quirúrgicos: Da Vinci, 14M+ cirugías.{'\n'}3. Espaciales: Perseverance, Ingenuity en Marte.{'\n'}4. Domésticos/cuidado: NEO de 1X, PARO en Japón.</Text></View>
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
      <Text style={styles.title}>El ciclo Sensor → IA → Actuador</Text>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        <View style={{ flex: 1 }}>
          {matchPairs.map((p, i) => (
            <TouchableOpacity key={i} style={[styles.matchItem, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }, matchLeft === i && { borderColor: '#475569', backgroundColor: '#f8fafc' }]} onPress={() => matchLeftClick(i)}>
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

  const renderQuiz = (items: QuizItem[], tag: string, title: string) => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>{tag}</Text></View>
      <Text style={styles.title}>{title}</Text>
      {items.map((q, qi) => (
        <View key={qi} style={{ marginBottom: 14 }}>
          <Text style={styles.quizQ}>{qi + 1}. {q.q}</Text>
          {q.opts.map((opt, oi) => (
            <TouchableOpacity key={oi} style={[styles.quizOpt, quizAnswers[qi] === oi && { borderColor: '#475569', backgroundColor: '#f8fafc' }]} onPress={() => selQuiz(qi, oi)} disabled={quizChecked}>
              <Text style={styles.quizLetter}>{String.fromCharCode(65 + oi)}</Text>
              <Text style={{ flex: 1, fontSize: 12 }}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );

  const renderDrag = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#eff6ff' }]}><Text style={[styles.tagText, { color: '#1e40af' }]}>🧩 Módulo 10 · Clasificar</Text></View>
      <Text style={styles.title}>Los sentidos del robot</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {sensorsItems.map((item, idx) => (
          dragPlaced[idx] === undefined && (
            <TouchableOpacity key={idx} style={[styles.chip, dragSel === idx && { borderColor: '#475569', backgroundColor: '#f8fafc' }]} onPress={() => setDragSel(dragSel === idx ? null : idx)}>
              <Text style={{ fontSize: 11 }}>{item.text}</Text>
            </TouchableOpacity>
          )
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['vista', 'tacto'] as const).map((col) => (
          <TouchableOpacity key={col} style={[styles.dropCol, { flex: 1 }]} onPress={() => { if (dragSel !== null) dropDrag(dragSel, col); }}>
            <Text style={{ fontWeight: 'bold', fontSize: 11, color: col === 'vista' ? '#1e40af' : '#92400e' }}>{col === 'vista' ? '👁️ Vista' : '👆 Tacto'}</Text>
            {Object.entries(dragPlaced).filter(([, v]) => v === col).map(([k]) => (
              <TouchableOpacity key={k} style={{ backgroundColor: col === 'vista' ? '#dbeafe' : '#fef3c7', padding: 4, borderRadius: 8, marginTop: 4 }} onPress={() => retDrag(parseInt(k))}>
                <Text style={{ fontSize: 10 }}>{sensorsItems[parseInt(k)].text} ✕</Text>
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderCompare = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>🆚 Módulo 16 · Prompt Compare</Text></View>
      <Text style={styles.title}>Robot programado vs robot que aprende</Text>
      <View style={[styles.card, { backgroundColor: '#f9fafb' }]}>
        <Text style={{ fontSize: 12, lineHeight: 20 }}>🔧 ROBOT TRADICIONAL:{'\n'}Programación rígida. Si encuentra algo nuevo, se detiene y pide ayuda.</Text>
      </View>
      <View style={[styles.card, { backgroundColor: '#fff1f2', borderColor: '#fecdd3' }]}>
        <Text style={{ fontSize: 12, lineHeight: 20 }}>🧠 ROBOT MODERNO (IA + foundation model):{'\n'}Ve un sillón donde no estaba, lo identifica, ajusta su ruta sin asistencia humana.</Text>
      </View>
      <Text style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>¿Cuál enfoque domina en 2025-2026?</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity style={[styles.optionBtn, { flex: 1 }, compareChoice === 'a' && { borderColor: '#475569', backgroundColor: '#f8fafc' }]} onPress={() => pickCompare('a')} disabled={compareChecked}>
          <Text style={{ textAlign: 'center', fontWeight: 'bold' }}>Bot A</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.optionBtn, { flex: 1 }, compareChoice === 'b' && { borderColor: '#475569', backgroundColor: '#f8fafc' }]} onPress={() => pickCompare('b')} disabled={compareChecked}>
          <Text style={{ textAlign: 'center', fontWeight: 'bold' }}>Bot B</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTF = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>✅ Módulo 17 · V/F</Text></View>
      <Text style={styles.title}>Ética y robótica · Verdad o mito</Text>
      {ethicsItems.map((item, idx) => (
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

  const renderBuilderCity = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f8fafc' }]}><Text style={[styles.tagText, { color: '#1e293b' }]}>🏙️ Módulo 18 · Builder</Text></View>
      <Text style={styles.title}>Diseña el robot que cambiaría tu ciudad</Text>
      {BUILDER_CITY.rows.map((row) => (
        <View key={row.key} style={{ marginBottom: 10 }}>
          <Text style={{ fontWeight: 'bold', color: '#1e293b', marginBottom: 4 }}>{row.label}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            {row.opts.map((opt) => (
              <TouchableOpacity key={opt} style={[styles.flowOpt, builderCity[row.key] === opt && { borderColor: '#475569', backgroundColor: '#f8fafc' }]} onPress={() => selBuilder(row.key, opt)}>
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
      <Text style={{ fontSize: 56 }}>🦾</Text>
      <Text style={[styles.title, { textAlign: 'center' }]}>¡Nivel 32 completado!</Text>
      <Text style={[styles.subtitle, { textAlign: 'center' }]}>Terminaste "Robótica e IA: El Cuerpo de la IA". Ahora eres Robotics Engineer.</Text>
      <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#475569', marginVertical: 12 }}>⭐ {xp} XP</Text>
      <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Volver al mapa</Text></TouchableOpacity>
    </View>
  );

  // ============ RENDER PRINCIPAL ============
  const renderStep = () => {
    switch (step) {
      case 0: return renderIntro();
      case 1: return renderTheory1();
      case 2: return renderReflect('🤔 Tu intuición', 'Piensa tú', '¿Qué imagen te viene a la cabeza cuando piensas en "robot"? ¿Qué SIENTES? Sé honesto antes de procesar todos los datos del nivel.', 'Cuando pienso en robot, imagino... y siento...', 80, '14');
      case 3: return renderMatching();
      case 4: return renderExpandCards([
        { emoji: '🐕', title: 'Spot · El perro robot', body: '32 kg, camina 1.6 m/s, sube escaleras, abre puertas. Cuesta ~$75,000 USD. Miles trabajando en el mundo real desde 2020.', fact: '⭐ NYPD lo usó en 2021. Plantas químicas y nucleares lo usan donde sería peligroso enviar humanos.' },
        { emoji: '🤸', title: 'Atlas · El humanoide acrobático', body: '1.5m, 89 kg, 28 grados de libertad. En 2024 presentó versión eléctrica. NO es producto comercial aún — es plataforma de investigación.', fact: '⭐ Sus capacidades de hace 5 años son las que veremos en producción en 5-10 años.' },
        { emoji: '🏭', title: 'Stretch · El robot de bodegas', body: 'El más rentable comercialmente. Especializado en descargar contenedores y mover cajas. DHL, GAP lo despliegan.', fact: '⭐ El robot "aburrido" es el que gana dinero.' },
        { emoji: '🎯', title: 'El método de entrenamiento', body: 'Simulación masiva + refuerzo + tuning humano. Antes de poner Atlas a hacer parkour real, entrena en simulación equivalente a años de práctica humana.', fact: '⭐ Los robots ya no se programan paso a paso. Aprenden imitando + experimentando en simulación.' },
      ], '🐕 Módulo 4 · Boston Dynamics', 'Boston Dynamics · Spot, Atlas, Stretch');
      case 5: return renderExpandCards([
        { emoji: '🤖', title: 'Figure 02 · El humanoide industrial', body: 'Startup valuada en $2.6B. 1.65m, 70 kg, 5h batería, conectado a GPT-4. BMW lo usa en línea de ensamblaje desde 2024.', fact: '⭐ Primer humanoide en una planta automotriz seria.' },
        { emoji: '🔋', title: 'Tesla Optimus (Bot)', body: 'Elon afirma producción masiva 2026 con precio ~$25,000 USD. Crítica: muchos demos fueron teleoperados, no autónomos.', fact: '⭐ Si llega a $25K USD masivo, redefine el sector.' },
        { emoji: '🌏', title: 'Unitree H1 (China)', body: 'Humanoide bípedo a $90,000 USD. China apuesta fuerte: BYD, Xiaomi, Huawei tienen proyectos humanoides.', fact: '⭐ La carrera no es solo USA — el ecosistema chino fabrica robots ya en 2024-2025.' },
        { emoji: '🇨🇴', title: '1X Technologies · NEO', body: 'Startup noruega respaldada por OpenAI. Robot diseñado para HOGARES: tareas domésticas, conversación natural, gestos suaves.', fact: '⭐ Apuesta opuesta: el robot doméstico amigable para adopción masiva en hogares.' },
      ], '🤖 Módulo 5 · Humanoides', 'Humanoides 2024-2026 · Figure, Tesla, 1X, Unitree');
      case 6: return renderQuiz(purposeQItems, '❓ Módulo 6 · Quiz', '¿Para qué sirve un humanoide?');
      case 7: return renderReflect('💼 Robots y trabajo', 'Piensa tú', '¿Crees que los robots van a destruir más empleos de los que crearán, o al revés? ¿Qué tipo de trabajos crees que van a sobrevivir más tiempo y por qué?', 'Creo que destruirán/crearán más empleos porque...', 120, '16');
      case 8: return renderExpandCards([
        { emoji: '🩺', title: 'Da Vinci · El cirujano robótico', body: 'Brazos robóticos controlados por cirujano. Precisión sub-milimétrica, sin temblor humano. 14M+ cirugías realizadas mundialmente.', fact: '⭐ Costo: $2M USD por sistema. NO es autónomo — es extensión del cirujano.' },
        { emoji: '🇨🇴', title: 'Da Vinci en Colombia', body: 'Hospitales como Fundación Santa Fe (Bogotá), Clínica Imbanaco (Cali) y CES (Medellín) tienen Da Vinci.', fact: '⭐ Solo se justifica con volumen alto de cirugías. Por eso está en hospitales de referencia.' },
        { emoji: '🤖', title: 'El siguiente paso: cirugía con AGI', body: 'STAR demostró suturas más uniformes que humanos. Aún en fase experimental.', fact: '⭐ Bioética compleja: ¿quién es responsable si una IA quirúrgica causa daño?' },
      ], '🩺 Módulo 8 · Cirugía', 'Cirugía robótica · Da Vinci');
      case 9: return renderQuiz(rlQItems, '❓ Módulo 9 · Quiz', 'Aprendizaje por refuerzo: cómo aprenden a moverse');
      case 10: return renderDrag();
      case 11: return renderExpandCards([
        { emoji: '🚀', title: 'Perseverance · El rover científico actual', body: 'Aterrizó en Marte el 18 febrero 2021. Recolecta muestras para misión de retorno futura. 23 cámaras, espectrómetros, taladros.', fact: '⭐ Primer rover en producir oxígeno en Marte (MOXIE experiment).' },
        { emoji: '🚁', title: 'Ingenuity · El primer helicóptero extraplanetario', body: '1.8 kg, voló 72 veces en Marte entre 2021 y enero 2024.', fact: '⭐ Abrió la puerta a futuras misiones con drones autónomos.' },
        { emoji: '🤖', title: 'Robonaut 2 · Primer humanoide en el espacio', body: 'NASA + GM. Primer humanoide en la EEI (2011-2018). Demostró que humanoides pueden trabajar en gravedad cero.', fact: '⭐ Desafío único: radiación dañina, mantenimiento imposible.' },
      ], '🚀 Módulo 11 · Espacio', 'Robots en el espacio · Marte y la EEI');
      case 12: return renderExpandCards([
        { emoji: '🇯🇵', title: 'Japón · Pionero de robots de cuidado', body: 'Invierte $1B+/año. Tres categorías: físicos (HAL), sociales (Pepper, PARO), monitoreo (sensores en casa).', fact: '⭐ PARO: robot foca terapéutico aprobado como dispositivo médico en USA.' },
        { emoji: '🦾', title: 'Exoesqueletos para cuidadores', body: 'Reducen esfuerzo físico de cuidadores al levantar pacientes. Ya en hospitales de Japón, EE.UU., Alemania.', fact: '⭐ Si exoesqueleto evita lesión de espalda del cuidador, pago se justifica en meses.' },
        { emoji: '💬', title: 'Compañía y monitoreo · ElliQ', body: 'Compañeros de IA conversacional diseñados para mayores que viven solos. Recuerdan medicaciones, conversan, llaman a familia.', fact: '⭐ ¿Reemplazan visitas humanas? Riesgo de aislamiento prolongado. Bien diseñados, complementan; mal diseñados, sustituyen.' },
      ], '👵 Módulo 12 · Cuidado mayores', 'Robots que cuidan a personas mayores');
      case 13: return renderQuiz(advancedQItems, '❓ Módulo 13 · Quiz', 'El estado del arte en 2025-2026');
      case 14: return renderExpandCards([
        { emoji: '📦', title: 'Delivery: Wing (Google) y Amazon Prime Air', body: 'Wing opera en Australia, Texas y Virginia desde 2019. Drones autónomos entregan paquetes <1.5 kg en 6-8 minutos.', fact: '⭐ Gana en farmacia urgente, alimentos calientes y zonas rurales.' },
        { emoji: '🌾', title: 'Agricultura · DJI Agras', body: 'Tractor del aire: rocía pesticidas y fertilizantes. Cubre 16 hectáreas/hora vs 1-2 de humano.', fact: '⭐ Ya en uso masivo en China, Brasil, Argentina, Colombia.' },
        { emoji: '🚁', title: 'Rescate · Drones con cámaras térmicas', body: 'Bomberos usan drones para encontrar personas en incendios forestales. Reducen búsquedas de horas a minutos.', fact: '⭐ Caso emblemático: drone detectó persona viva entre escombros tras incendios de Maui (2023).' },
      ], '📦 Módulo 14 · Drones', 'Drones · Delivery, agricultura, rescate');
      case 15: return renderExpandCards([
        { emoji: '🐬', title: 'Saildrone · Vela autónoma', body: 'Drones de superficie que recorren océanos por meses sin tripulación, alimentados por solar + viento.', fact: '⭐ Navegó dentro de un huracán categoría 4 en 2021 enviando datos en tiempo real.' },
        { emoji: '🤖', title: 'Robots submarinos para arqueología', body: 'Hércules y Argos descubrieron el USS Indianapolis y restos del Endurance de Shackleton a 3 km bajo el hielo.', fact: '⭐ Trabajan donde humanos morirían.' },
        { emoji: '🌊', title: 'Limpieza oceánica · The Ocean Cleanup', body: 'Barreras autónomas asistidas por drones que detectan y recolectan plástico oceánico. 13M kg limpiados desde 2019.', fact: '⭐ IA optimiza rutas según corrientes, viento y densidad de plástico.' },
      ], '🌊 Módulo 15 · Submarinos', 'Robots bajo el agua · Exploración y limpieza');
      case 16: return renderCompare();
      case 17: return renderTF();
      case 18: return renderBuilderCity();
      case 19: return renderReflect('✍️ Tu visión de robótica', 'Piensa tú', 'Después de explorar robots reales: ¿cómo cambió tu visión sobre robots? ¿Qué te entusiasma genuinamente? ¿Qué te preocupa con razón? Si pudieras introducir UN tipo de robot en tu ciudad mañana, ¿cuál sería y por qué?', 'Lo que más me entusiasma: ... Lo que me preocupa: ...', 150, '22');
      case 20: return renderCompletion();
      default: return null;
    }
  };

  const progress = (step / (TOTAL_STEPS - 1)) * 100;

  const handleMain = () => {
    const handlers: Record<number, (() => boolean) | undefined> = {
      2: () => checkReflect(80, 14),
      3: () => matchDone >= matchPairs.length,
      6: () => checkQuizGen(purposeQItems),
      7: () => checkReflect(120, 16),
      9: () => checkQuizGen(rlQItems),
      10: checkDrag,
      13: () => checkQuizGen(advancedQItems),
      16: checkCompare,
      17: checkTF,
      18: checkBuilder,
      19: () => checkReflect(150, 22),
    };
    const h = handlers[step];
    if (h) { if (!h()) return; }
    goNext();
  };

  const showNext = step < TOTAL_STEPS - 1 && ![2, 3, 6, 7, 9, 10, 13, 16, 17, 18, 19].includes(step);
  const showCheck = [2, 3, 6, 7, 9, 10, 13, 16, 17, 18, 19].includes(step) && step < TOTAL_STEPS - 1;

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={() => router.back()}><MaterialIcons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
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
  progressFill: { height: '100%', backgroundColor: '#475569', borderRadius: 3 },
  xpText: { fontWeight: 'bold', fontSize: 14, color: '#854d0e' },
  scroll: { padding: 16, paddingBottom: 40 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  iconCircle: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { ...typography.extraBold, fontSize: 19, color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 18 },
  bodyText: { fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 12 },
  card: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTitle: { fontWeight: 'bold', fontSize: 13, color: '#111827', marginBottom: 4 },
  cardText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  highlight: { borderLeftWidth: 3, borderLeftColor: '#475569', borderRadius: 4, padding: 11, marginVertical: 8 },
  highlightText: { color: '#1e293b', fontSize: 13, lineHeight: 20 },
  chip: { padding: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff', marginBottom: 4 },
  dropCol: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db', borderRadius: 12, padding: 8, minHeight: 60 },
  matchItem: { padding: 10, borderRadius: 10, borderWidth: 1.5, marginBottom: 4, minHeight: 50, justifyContent: 'center' },
  quizQ: { fontWeight: 'bold', fontSize: 13, padding: 11, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  quizOpt: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, marginBottom: 6, gap: 9 },
  quizLetter: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#f3f4f6', textAlign: 'center', lineHeight: 22, fontSize: 10, fontWeight: 'bold' },
  tfQuestion: { fontWeight: 'bold', fontSize: 13, padding: 11, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  tfBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center' },
  optionBtn: { padding: 12, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb', marginBottom: 8, backgroundColor: '#f9fafb' },
  flowOpt: { padding: 7, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff', marginBottom: 4 },
  textArea: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 13, minHeight: 100, textAlignVertical: 'top', marginBottom: 8 },
  nextBtn: { backgroundColor: '#475569', padding: 14, margin: 16, borderRadius: 11, alignItems: 'center' },
  nextText: { fontWeight: 'bold', color: '#fff', fontSize: 15 },
  finishBtn: { backgroundColor: '#475569', padding: 14, borderRadius: 11, width: '100%', alignItems: 'center', marginTop: 14 },
});